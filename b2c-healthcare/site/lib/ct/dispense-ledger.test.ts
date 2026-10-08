import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import type { Prescription } from '@/lib/clinical/types';
import { CONTAINERS } from '@/lib/ct/custom-objects';
import { consumeAuthorization, DispenseRefusedError, restoreAuthorization, type ConsumeLine } from '@/lib/ct/dispense-ledger';
import type { LedgerEntry } from '@/lib/dispense/ledger-types';

const NOW = new Date('2026-10-08T12:00:00Z');
const SAM = 'pt_sam';

const rx = (over: Partial<Prescription> = {}): Prescription => ({
  number: 'RX-77102',
  patientRef: SAM,
  prescriber: 'Dr. Test',
  issuedAt: '2026-09-24',
  refillsLeft: 3,
  lines: [
    { lineRef: 'RX-77102-1', sku: 'MED-a', name: 'A', sig: 'sig', qty: 30 },
    { lineRef: 'RX-77102-2', sku: 'MED-b', name: 'B', sig: 'sig', qty: 30 },
  ],
  ...over,
});

const line = (over: Partial<ConsumeLine> = {}): ConsumeLine => ({
  patientRef: SAM,
  rxNumber: 'RX-77102',
  lineRef: 'RX-77102-1',
  sku: 'MED-a',
  qty: 30,
  packs: 1,
  periodCeiling: 3,
  perOrderMax: 3,
  ...over,
});

function seed(value: Prescription): void {
  fake.objects.push({ id: `seed-${value.number}`, container: CONTAINERS.rx, key: value.number, version: 1, value, createdAt: '', lastModifiedAt: '' });
}
const stored = (number: string) => fake.objects.find((o) => o.container === CONTAINERS.rx && o.key === number)!;
const ledger = (orderId: string) => fake.objects.find((o) => o.container === CONTAINERS.dispenseLedger && o.key === orderId);

beforeEach(() => {
  fake = createFakeObjects();
});

describe('prescription-bound-supply: Supply within the authorization', () => {
  it('consumes one refill and writes the ledger entry for the order id', async () => {
    seed(rx());
    expect(await consumeAuthorization('ord-1', [line(), line({ lineRef: 'RX-77102-2', sku: 'MED-b' })], NOW)).toEqual({ alreadyConsumed: false });
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(2);
    const entry = ledger('ord-1')!.value as LedgerEntry;
    expect(entry).toMatchObject({ orderId: 'ord-1', patientRef: SAM, period: '2026-10' });
    expect(entry.lines.map((l) => l.sku)).toEqual(['MED-a', 'MED-b']);
  });

  it('the ledger keeps references and quantities only', async () => {
    seed(rx());
    await consumeAuthorization('ord-1', [line()], NOW);
    const text = JSON.stringify(ledger('ord-1')!.value);
    expect(text).not.toMatch(/sig|Dr\. Test|"name"/);
  });
});

describe('prescription-bound-supply: second call for the same order is a no-op', () => {
  it('idempotent on the order id', async () => {
    seed(rx());
    await consumeAuthorization('ord-1', [line()], NOW);
    expect(await consumeAuthorization('ord-1', [line()], NOW)).toEqual({ alreadyConsumed: true });
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(2);
  });

  it('a crash after the decrement but before the ledger write: the retry does not decrement twice', async () => {
    seed(rx());
    let armed = true;
    fake.failOn = (op, container) => {
      if (armed && op === 'post' && container === CONTAINERS.dispenseLedger) {
        armed = false;
        return new Error('crash');
      }
      return undefined;
    };
    await expect(consumeAuthorization('ord-1', [line()], NOW)).rejects.toThrow('crash');
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(2);
    expect(await consumeAuthorization('ord-1', [line()], NOW)).toEqual({ alreadyConsumed: false });
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(2);
    expect(ledger('ord-1')).toBeDefined();
  });
});

describe('prescription-bound-supply: optimistic concurrency', () => {
  it('a version conflict re-reads and retries; no refill is lost', async () => {
    seed(rx());
    let armed = true;
    fake.failOn = (op, container, key) => {
      if (armed && op === 'post' && container === CONTAINERS.rx) {
        armed = false;
        // another order consumes a refill between our read and our write
        const o = stored(key);
        o.value = { ...(o.value as Prescription), refillsLeft: 2, consumedBy: ['ord-other'] };
        o.version += 1;
        return Object.assign(new Error('conflict'), { statusCode: 409 });
      }
      return undefined;
    };
    await consumeAuthorization('ord-1', [line()], NOW);
    const value = stored('RX-77102').value as Prescription;
    expect(value.refillsLeft).toBe(1);
    expect(value.consumedBy).toEqual(['ord-other', 'ord-1']);
  });

  it('concurrent orders for the last refill: exactly one wins, the other is refused', async () => {
    seed(rx({ refillsLeft: 1 }));
    const results = await Promise.allSettled([
      consumeAuthorization('ord-a', [line()], NOW),
      consumeAuthorization('ord-b', [line()], NOW),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(DispenseRefusedError);
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(0);
  });

  it('a version conflict that never clears gives up instead of looping', async () => {
    seed(rx());
    fake.failOn = (op, container) =>
      op === 'post' && container === CONTAINERS.rx ? Object.assign(new Error('conflict'), { statusCode: 409 }) : undefined;
    await expect(consumeAuthorization('ord-1', [line()], NOW)).rejects.toThrow(/contended/);
  });
});

describe('prescription-bound-supply: refusals consume nothing', () => {
  it('exhausted: refused with nothing available', async () => {
    seed(rx({ refillsLeft: 0 }));
    await expect(consumeAuthorization('ord-1', [line()], NOW)).rejects.toMatchObject({ refusal: { reason: 'NO_REFILLS', remaining: 0 } });
    expect(ledger('ord-1')).toBeUndefined();
  });

  it('Authorization outside its window: refused as EXPIRED', async () => {
    seed(rx({ expiresAt: '2026-10-01' }));
    await expect(consumeAuthorization('ord-1', [line()], NOW)).rejects.toMatchObject({ refusal: { reason: 'EXPIRED' } });
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(3);
  });

  it('another patient prescription is refused', async () => {
    seed(rx());
    await expect(consumeAuthorization('ord-1', [line({ patientRef: 'pt_alex' })], NOW)).rejects.toBeInstanceOf(DispenseRefusedError);
  });

  it('a partial quantity is not supplied', async () => {
    seed(rx());
    await expect(consumeAuthorization('ord-1', [line({ qty: 10 })], NOW)).rejects.toBeInstanceOf(DispenseRefusedError);
  });

  it('two prescriptions in one order: if the second is exhausted the first is not touched', async () => {
    seed(rx());
    seed(rx({ number: 'RX-2', refillsLeft: 0, lines: [{ lineRef: 'RX-2-1', sku: 'MED-c', name: 'C', sig: 's', qty: 10 }] }));
    await expect(
      consumeAuthorization('ord-1', [line(), line({ rxNumber: 'RX-2', lineRef: 'RX-2-1', sku: 'MED-c', qty: 10 })], NOW),
    ).rejects.toBeInstanceOf(DispenseRefusedError);
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(3);
  });
});

describe('prescription-bound-supply: Abandoned cart consumes nothing', () => {
  it('nothing in this module runs before order placement: lookups and validation leave malva-rx and the ledger untouched', async () => {
    seed(rx());
    const before = JSON.stringify(fake.objects);
    const { getObject } = await import('@/lib/ct/custom-objects');
    await getObject(CONTAINERS.rx, 'RX-77102');
    expect(JSON.stringify(fake.objects)).toBe(before);
    expect(fake.objects.filter((o) => o.container === CONTAINERS.dispenseLedger)).toHaveLength(0);
  });
});

describe('restoreAuthorization (cancellation before packed-shipped)', () => {
  it('restores the refill and marks the ledger; a second call is a no-op', async () => {
    seed(rx());
    await consumeAuthorization('ord-1', [line()], NOW);
    expect(await restoreAuthorization('ord-1', NOW)).toEqual({ restored: true });
    const value = stored('RX-77102').value as Prescription;
    expect(value.refillsLeft).toBe(3);
    expect(value.consumedBy).toEqual([]);
    expect((ledger('ord-1')!.value as LedgerEntry).restoredAt).toBe(NOW.toISOString());
    expect(await restoreAuthorization('ord-1', NOW)).toEqual({ restored: false });
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(3);
  });

  it('an order that never consumed anything restores nothing', async () => {
    seed(rx());
    expect(await restoreAuthorization('ord-unknown', NOW)).toEqual({ restored: false });
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(3);
  });

  it('survives a version conflict while restoring', async () => {
    seed(rx());
    await consumeAuthorization('ord-1', [line()], NOW);
    let armed = true;
    fake.failOn = (op, container, key) => {
      if (armed && op === 'post' && container === CONTAINERS.rx) {
        armed = false;
        const o = stored(key);
        o.version += 1;
        return Object.assign(new Error('conflict'), { statusCode: 409 });
      }
      return undefined;
    };
    await restoreAuthorization('ord-1', NOW);
    expect((stored('RX-77102').value as Prescription).refillsLeft).toBe(3);
  });
});
