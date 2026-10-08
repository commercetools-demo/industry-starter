import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import type { Prescription } from '@/lib/clinical/types';
import { checkLineCeiling, getUsedBySku, getUsedInPeriod, monthOf, periodCeilingFor } from '@/lib/ct/ceilings';
import { CONTAINERS } from '@/lib/ct/custom-objects';
import { consumeAuthorization, restoreAuthorization, type ConsumeLine } from '@/lib/ct/dispense-ledger';

const SAM = 'pt_sam';
const OCT = new Date('2026-10-08T12:00:00Z');
const NOV = new Date('2026-11-02T09:00:00Z');

const rx = (n: number): Prescription => ({
  number: `RX-${n}`,
  patientRef: SAM,
  prescriber: 'Dr. Test',
  issuedAt: '2026-09-24',
  refillsLeft: 5,
  lines: [{ lineRef: `RX-${n}-1`, sku: 'MED-amox', name: 'Amox', sig: 's', qty: 21 }],
});
const line = (n: number, over: Partial<ConsumeLine> = {}): ConsumeLine => ({
  patientRef: SAM,
  rxNumber: `RX-${n}`,
  lineRef: `RX-${n}-1`,
  sku: 'MED-amox',
  qty: 21,
  packs: 1,
  perOrderMax: 2,
  periodCeiling: 2,
  ...over,
});
const seed = (value: Prescription) => fake.objects.push({ id: value.number, container: CONTAINERS.rx, key: value.number, version: 1, value, createdAt: '', lastModifiedAt: '' });

beforeEach(() => {
  fake = createFakeObjects();
  for (const n of [1, 2, 3, 4]) seed(rx(n));
});

describe('dispensing-quantity-limit: Order within the ceiling', () => {
  it('the first order of the month is accepted and counted', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    expect(await getUsedInPeriod(SAM, 'MED-amox', '2026-10')).toBe(1);
  });
});

describe('dispensing-quantity-limit: Second order inside the same period', () => {
  it('is refused on the cumulative count at order creation', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    await consumeAuthorization('o2', [line(2)], OCT);
    await expect(consumeAuthorization('o3', [line(3)], OCT)).rejects.toMatchObject({
      refusal: { reason: 'CEILING', scope: 'period', ceiling: 2, remaining: 0 },
    });
    expect(await getUsedInPeriod(SAM, 'MED-amox', '2026-10')).toBe(2);
  });

  it('the counts are per patient', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    expect(await getUsedInPeriod('pt_other', 'MED-amox', '2026-10')).toBe(0);
  });

  it('a cancelled order (restored) frees its quantity again', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    await restoreAuthorization('o1', OCT);
    expect(await getUsedInPeriod(SAM, 'MED-amox', '2026-10')).toBe(0);
  });
});

describe('dispensing-quantity-limit: Period rolls over', () => {
  it('the full ceiling is available again the next calendar month', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    await consumeAuthorization('o2', [line(2)], OCT);
    expect(monthOf(NOV.toISOString())).toBe('2026-11');
    expect(await getUsedInPeriod(SAM, 'MED-amox', '2026-11')).toBe(0);
    await expect(consumeAuthorization('o3', [line(3)], NOV)).resolves.toEqual({ alreadyConsumed: false });
  });
});

describe('dispensing-quantity-limit: Ceiling lowered while a cart is open', () => {
  it('re-checking the line with the lowered ceiling refuses it, stating the new ceiling', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    const args = { patientRef: SAM, sku: 'MED-amox', packs: 1, perOrderMax: 2, at: '2026-10-09' };
    expect((await checkLineCeiling({ ...args, periodCeiling: 2 })).reason).toBe('OK');
    expect(await checkLineCeiling({ ...args, periodCeiling: 1 })).toMatchObject({ reason: 'CEILING', ceiling: 1, remaining: 0 });
  });

  it('order creation re-checks too: a ceiling lowered after the cart was built refuses the order', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    await expect(consumeAuthorization('o2', [line(2, { periodCeiling: 1, perOrderMax: 1 })], OCT)).rejects.toMatchObject({ refusal: { reason: 'CEILING', ceiling: 1 } });
  });
});

describe('ceilings: helpers', () => {
  it('counts every SKU of a month in one read', async () => {
    await consumeAuthorization('o1', [line(1)], OCT);
    expect([...(await getUsedBySku(SAM, '2026-10'))]).toEqual([['MED-amox', 1]]);
  });

  it('the period ceiling defaults to the per-order limit; no limit means no ceiling', () => {
    expect(periodCeilingFor(3)).toBe(3);
    expect(periodCeilingFor(null)).toBeNull();
  });
});
