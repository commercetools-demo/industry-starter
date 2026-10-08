import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';
import { candidateSlots, slotClaimKey, zonedToUtc, type Schedule } from '@/lib/clinical/slots';
import { claimSlot, getClaim, listFreeSlots, releaseSlot, SlotTakenError } from '@/lib/ct/scheduling';

const NY = 'America/New_York';
const sched = (weekly: Schedule['weekly'], timezone = NY): Schedule => ({ timezone, weekly, slotMinutes: 30 });
const DOC = 'mlv-doc-test';

describe('slot maths (Intl time zones)', () => {
  it('DST day: spring forward shifts the UTC hour and a non-existent wall time yields no slot', () => {
    const s = sched({ sat: ['09:00'], sun: ['02:30', '09:00'] });
    const slots = candidateSlots(s, new Date('2026-03-07T05:00:00Z'), 3);
    expect(slots.map((x) => [x.localDate, x.localTime, x.startsAt])).toEqual([
      ['2026-03-07', '09:00', '2026-03-07T14:00:00.000Z'], // EST, UTC-5
      ['2026-03-08', '09:00', '2026-03-08T13:00:00.000Z'], // EDT, UTC-4: 02:30 does not exist and is skipped
    ]);
  });

  it('DST day: fall back', () => {
    const s = sched({ sat: ['09:00'], sun: ['09:00'] });
    const slots = candidateSlots(s, new Date('2026-10-31T05:00:00Z'), 2);
    expect(slots.map((x) => x.startsAt)).toEqual(['2026-10-31T13:00:00.000Z', '2026-11-01T14:00:00.000Z']);
  });

  it('zonedToUtc gives the same wall time in two zones different UTC instants', () => {
    expect(zonedToUtc('America/Chicago', 2026, 10, 9, 9, 0)).toBe(Date.UTC(2026, 9, 9, 14, 0));
    expect(zonedToUtc(NY, 2026, 10, 9, 9, 0)).toBe(Date.UTC(2026, 9, 9, 13, 0));
  });

  it('"today" is today in the clinic zone, not in UTC', () => {
    // 01:00 UTC on Oct 9 is still the evening of Oct 8 in New York
    const s = sched({ thu: ['08:00', '23:59'], fri: ['09:00'] });
    const slots = candidateSlots(s, new Date('2026-10-09T01:00:00Z'), 2);
    expect(slots[0].localDate).toBe('2026-10-08');
    expect(slots.map((x) => x.localTime)).toContain('09:00');
    expect(slots.find((x) => x.localTime === '08:00')).toBeUndefined(); // past
  });

  it('slot claim keys use only characters Custom Object keys allow', () => {
    const key = slotClaimKey(DOC, 'remote', '2026-10-09T13:00:00.000Z');
    expect(key).toBe('mlv-doc-test.remote.20261009T130000Z');
    expect(key).toMatch(/^[-_~.a-zA-Z0-9]+$/);
  });
});

describe('scheduling (Custom Objects)', () => {
  beforeEach(async () => {
    fake = createFakeObjects();
    await putObject(CONTAINERS.schedule, DOC, sched({ thu: ['09:00', '10:00', '10:30', '16:00'] }));
  });

  it('lists the next 7 days of the pattern, in the clinic zone', async () => {
    const slots = await listFreeSlots(DOC, 'office', new Date('2026-10-08T10:00:00Z'), 7);
    // Thu 2026-10-08 09:00 NY = 13:00Z is later than now+2h only from 10:00Z: 12:00Z cutoff -> 13:00Z shown; and next Thu is day 7 (outside the 7-day window)
    expect(slots.map((s) => s.startsAt)).toEqual(['2026-10-08T13:00:00.000Z', '2026-10-08T14:00:00.000Z', '2026-10-08T14:30:00.000Z', '2026-10-08T20:00:00.000Z']);
    expect(slots[0]).toMatchObject({ localDate: '2026-10-08', localTime: '09:00', timezone: NY });
  });

  it('past slots and slots less than 2 h away are hidden (exactly 2 h is shown)', async () => {
    // now = 08:00 NY: 09:00 is 1 h away (hidden), 10:00 is exactly 2 h away (shown)
    const slots = await listFreeSlots(DOC, 'office', new Date('2026-10-08T12:00:00Z'), 1);
    expect(slots.map((s) => s.localTime)).toEqual(['10:00', '10:30', '16:00']);
    const late = await listFreeSlots(DOC, 'office', new Date('2026-10-08T20:30:00Z'), 1);
    expect(late).toEqual([]);
  });

  it('claimed slots disappear for that mode only', async () => {
    const now = new Date('2026-10-08T05:00:00Z');
    await claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z');
    expect((await listFreeSlots(DOC, 'office', now, 1)).map((s) => s.localTime)).toEqual(['10:00', '10:30', '16:00']);
    expect((await listFreeSlots(DOC, 'remote', now, 1)).map((s) => s.localTime)).toEqual(['09:00', '10:00', '10:30', '16:00']);
  });

  it('release makes the slot free again', async () => {
    await claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z');
    await releaseSlot(DOC, 'office', '2026-10-08T13:00:00.000Z');
    expect(await getClaim(DOC, 'office', '2026-10-08T13:00:00.000Z')).toBeNull();
    await expect(claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z')).resolves.toBeUndefined();
  });

  it('claiming creates with version 0', async () => {
    await claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z');
    expect(fake.objects.find((o) => o.container === CONTAINERS.slotClaim)?.version).toBe(1);
    expect(fake.calls.filter((c) => c.op === 'post' && c.container === CONTAINERS.slotClaim)).toHaveLength(1);
  });

  it('concurrent claim: the second fails with SlotTakenError', async () => {
    const results = await Promise.allSettled([claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z'), claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(SlotTakenError);
  });

  it('a different start time normalises to the same claim', async () => {
    await claimSlot(DOC, 'office', '2026-10-08T09:00:00-04:00');
    await expect(claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z')).rejects.toBeInstanceOf(SlotTakenError);
  });

  it('a doctor without a schedule has no slots', async () => {
    expect(await listFreeSlots('mlv-doc-nobody', 'remote', new Date('2026-10-08T05:00:00Z'))).toEqual([]);
  });

  it('other errors are not turned into "slot taken"', async () => {
    fake.failOn = () => Object.assign(new Error('boom'), { statusCode: 500 });
    await expect(claimSlot(DOC, 'office', '2026-10-08T13:00:00.000Z')).rejects.toThrow('boom');
  });
});
