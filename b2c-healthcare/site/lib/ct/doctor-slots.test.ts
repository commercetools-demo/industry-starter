// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';
import { claimSlot } from '@/lib/ct/scheduling';
import { getSlotDays, groupByDay, zoneDates } from '@/lib/ct/doctor-slots';

const DOC = 'mlv-doc-test';
const EARLY = new Date('2026-10-08T05:00:00Z'); // Thu 01:00 in New York
const AT_NINE = new Date('2026-10-08T13:00:00Z'); // Thu 09:00 in New York

beforeEach(async () => {
  fake = createFakeObjects();
  await putObject(CONTAINERS.schedule, DOC, { timezone: 'America/New_York', slotMinutes: 30, weekly: { thu: ['10:00', '16:00'], fri: ['09:30'] } });
});

describe('product-detail-page / design-pdp: booking panel data', () => {
  it('seven clinic-local days starting today, each with its free times; a day without free time stays in the list', async () => {
    const res = await getSlotDays(DOC, 'remote', EARLY);
    expect(res?.timezone).toBe('America/New_York');
    expect(res?.days.map((d) => d.date)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']);
    expect(res?.days[0].slots).toEqual([
      { startsAt: '2026-10-08T14:00:00.000Z', time: '10:00' },
      { startsAt: '2026-10-08T20:00:00.000Z', time: '16:00' },
    ]);
    expect(res?.days[1].slots).toEqual([{ startsAt: '2026-10-09T13:30:00.000Z', time: '09:30' }]);
    expect(res?.days[2].slots).toEqual([]);
  });

  it('past-slot hiding: a time less than 2 hours away is not offered', async () => {
    const res = await getSlotDays(DOC, 'remote', AT_NINE);
    expect(res?.days[0].slots.map((s) => s.time)).toEqual(['16:00']);
  });

  it('a claimed slot disappears for that mode only', async () => {
    await claimSlot(DOC, 'office', '2026-10-08T14:00:00.000Z');
    expect((await getSlotDays(DOC, 'office', EARLY))?.days[0].slots.map((s) => s.time)).toEqual(['16:00']);
    expect((await getSlotDays(DOC, 'remote', EARLY))?.days[0].slots.map((s) => s.time)).toEqual(['10:00', '16:00']);
  });

  it('a doctor without a schedule is null (unknown doctor)', async () => {
    expect(await getSlotDays('mlv-doc-nobody', 'remote', EARLY)).toBeNull();
  });

  it('dates follow the clinic zone, not UTC (21:30 in New York is already tomorrow in UTC)', () => {
    expect(zoneDates('America/New_York', new Date('2026-10-09T01:30:00Z'), 2)).toEqual(['2026-10-08', '2026-10-09']);
    expect(groupByDay('America/New_York', [], new Date('2026-10-09T01:30:00Z'), 1)).toEqual([{ date: '2026-10-08', slots: [] }]);
  });
});
