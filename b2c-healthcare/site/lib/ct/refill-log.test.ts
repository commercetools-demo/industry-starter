import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { getRunLog, lastRunsOf, refillLogKey, writeRunLog } from '@/lib/ct/refill-log';

const entry = (over: Partial<Parameters<typeof writeRunLog>[0]> = {}) => ({ recurringOrderId: 'ro1', runAt: '2026-11-07T05:00:00Z', runFor: '2026-11-08T10:00:00Z', outcome: 'skipped' as const, reason: 'authorization-expired' as const, ...over });

beforeEach(() => {
  fake = createFakeObjects();
});

describe('subscriptions-and-recurring-orders: malva-refill-log', () => {
  it('records {recurringOrderId, runAt, outcome, reason} in the malva-refill-log container under a key made of ids and digits', async () => {
    await writeRunLog(entry());
    const [stored] = fake.objects;
    expect(stored).toMatchObject({ container: 'malva-refill-log', key: 'ro1.20261108100000' });
    expect(stored?.value).toEqual(entry());
    expect(CONTAINERS.refillLog).toBe('malva-refill-log');
    expect(refillLogKey('ro/1', '2026-11-08T10:00:00Z')).toBe('ro1.20261108100000');
  });

  it('a run that was checked is found again by recurring order and run date; another run is not', async () => {
    await writeRunLog(entry());
    expect(await getRunLog('ro1', '2026-11-08T10:00:00Z')).toEqual(entry());
    expect(await getRunLog('ro1', '2026-12-08T10:00:00Z')).toBeNull();
  });

  it('the last run of each recurring order is the newest check, for several orders in one read', async () => {
    await writeRunLog(entry({ runAt: '2026-10-07T05:00:00Z', runFor: '2026-10-08T10:00:00Z', outcome: 'allowed', reason: undefined }));
    await writeRunLog(entry());
    await writeRunLog(entry({ recurringOrderId: 'ro2', outcome: 'stopped', reason: 'authorization-exhausted' }));
    await writeRunLog(entry({ recurringOrderId: 'other' }));
    const last = await lastRunsOf(['ro1', 'ro2', 'missing']);
    expect([...last.keys()].sort()).toEqual(['ro1', 'ro2']);
    expect(last.get('ro1')).toEqual({ runAt: '2026-11-07T05:00:00Z', outcome: 'skipped', reason: 'authorization-expired' });
    expect(last.get('ro2')).toEqual({ runAt: '2026-11-07T05:00:00Z', outcome: 'stopped', reason: 'authorization-exhausted' });
    expect((await lastRunsOf([])).size).toBe(0);
  });

  it('holds nothing but ids, dates and a reason code (no medication, RX number or patient detail)', async () => {
    await writeRunLog(entry());
    expect(Object.keys(fake.objects[0]!.value as object).sort()).toEqual(['outcome', 'reason', 'recurringOrderId', 'runAt', 'runFor']);
  });
});
