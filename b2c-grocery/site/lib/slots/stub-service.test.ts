import { beforeEach, describe, expect, it } from 'vitest';
import { SLOT_CONFIG } from '../config/slots';
import { createStubSlotService } from './stub-service';
import type { SlotService } from './types';

// Monday 2026-10-12, 09:00 UTC: the 08-10 window has started, 10-12 has not.
const T0 = Date.parse('2026-10-12T09:00:00Z');
const area = { country: 'US', postalCode: '10001' };
let clock = T0;
let svc: SlotService;
const list = () => svc.listSlots({ ...area, fromDate: new Date(clock), days: SLOT_CONFIG.days });
const minutes = (n: number) => n * 60_000;

beforeEach(() => {
  clock = T0;
  svc = createStubSlotService({ now: () => new Date(clock) });
});

describe('listSlots', () => {
  it('lists 7 days of windows and excludes windows that already started', async () => {
    const slots = await list();
    expect(slots[0]).toMatchObject({ id: '20261012-10', start: '2026-10-12T10:00:00.000Z', end: '2026-10-12T12:00:00.000Z', remaining: 10 });
    expect(slots.find((s) => s.id === '20261012-08')).toBeUndefined();
    expect(slots).toHaveLength(5 + 6 * 6);
    expect(slots.at(-1)?.id).toBe('20261018-18');
  });

  it('Full slot hidden: a window with no capacity is not listed', async () => {
    for (let i = 0; i < SLOT_CONFIG.capacity; i++) expect((await svc.holdSlot('20261013-10', `cart-${i}`, 15)).ok).toBe(true);
    expect((await list()).find((s) => s.id === '20261013-10')).toBeUndefined();
    expect((await list()).find((s) => s.id === '20261013-12')?.remaining).toBe(10);
  });

  it('remaining = capacity - holds - bookings (a booking converts a hold)', async () => {
    await svc.holdSlot('20261013-10', 'a', 15);
    await svc.holdSlot('20261013-10', 'b', 15);
    await svc.confirmBooking('20261013-10', 'order-1');
    expect((await list()).find((s) => s.id === '20261013-10')?.remaining).toBe(8);
  });
});

describe('holdSlot', () => {
  it('11th hold on a window fails FULL', async () => {
    for (let i = 0; i < 10; i++) await svc.holdSlot('20261013-10', `cart-${i}`, 15);
    expect(await svc.holdSlot('20261013-10', 'cart-11', 15)).toEqual({ ok: false, reason: 'FULL' });
  });

  it('returns the expiry (15 minutes)', async () => {
    const r = await svc.holdSlot('20261013-10', 'a', SLOT_CONFIG.holdMinutes);
    expect(r).toEqual({ ok: true, expires: new Date(T0 + minutes(15)) });
  });

  it('Hold expires: capacity returns after 15 minutes', async () => {
    for (let i = 0; i < 10; i++) await svc.holdSlot('20261013-10', `cart-${i}`, 15);
    clock = T0 + minutes(15);
    const r = await svc.holdSlot('20261013-10', 'late', 15);
    expect(r.ok).toBe(true);
  });

  it('a new hold for the same cart releases the previous one', async () => {
    await svc.holdSlot('20261013-10', 'a', 15);
    await svc.holdSlot('20261013-12', 'a', 15);
    const slots = await list();
    expect(slots.find((s) => s.id === '20261013-10')?.remaining).toBe(10);
    expect(slots.find((s) => s.id === '20261013-12')?.remaining).toBe(9);
  });

  it('renewing the same slot is not blocked by the cart own hold', async () => {
    for (let i = 0; i < 9; i++) await svc.holdSlot('20261013-10', `cart-${i}`, 15);
    expect((await svc.holdSlot('20261013-10', 'mine', 15)).ok).toBe(true);
    expect((await svc.holdSlot('20261013-10', 'mine', 15)).ok).toBe(true);
    expect((await list()).find((s) => s.id === '20261013-10')).toBeUndefined();
  });

  it('a failed hold keeps the previous hold', async () => {
    await svc.holdSlot('20261013-12', 'a', 15);
    for (let i = 0; i < 10; i++) await svc.holdSlot('20261013-10', `cart-${i}`, 15);
    expect(await svc.holdSlot('20261013-10', 'a', 15)).toEqual({ ok: false, reason: 'FULL' });
    expect((await list()).find((s) => s.id === '20261013-12')?.remaining).toBe(9);
  });

  it.each(['20261012-08', '20261011-10', '20261020-10', '20261013-09', 'nope', '20261313-10'])('unknown or unbookable slot %s: UNKNOWN', async (id) => {
    expect(await svc.holdSlot(id, 'a', 15)).toEqual({ ok: false, reason: 'UNKNOWN' });
  });
});

describe('releaseHold', () => {
  it('returns the capacity', async () => {
    await svc.holdSlot('20261013-10', 'a', 15);
    await svc.releaseHold('a');
    expect((await list()).find((s) => s.id === '20261013-10')?.remaining).toBe(10);
  });

  it('releasing a cart without a hold is a no-op', async () => {
    await expect(svc.releaseHold('nobody')).resolves.toBeUndefined();
  });
});

describe('confirmBooking', () => {
  it('converts the hold into a booking (capacity unchanged) and survives hold expiry', async () => {
    await svc.holdSlot('20261013-10', 'a', 15);
    await svc.confirmBooking('20261013-10', 'order-1', 'a');
    clock = T0 + minutes(60);
    expect((await list()).find((s) => s.id === '20261013-10')?.remaining).toBe(9);
  });

  it('is idempotent for the same order', async () => {
    await svc.holdSlot('20261013-10', 'a', 15);
    await svc.holdSlot('20261013-10', 'b', 15);
    await svc.confirmBooking('20261013-10', 'order-1', 'a');
    await svc.confirmBooking('20261013-10', 'order-1', 'a');
    await svc.confirmBooking('20261013-10', 'order-1');
    expect((await list()).find((s) => s.id === '20261013-10')?.remaining).toBe(8);
  });

  it('without a cart id the oldest hold on the slot is converted', async () => {
    await svc.holdSlot('20261013-10', 'a', 15);
    await svc.confirmBooking('20261013-10', 'order-1');
    expect((await list()).find((s) => s.id === '20261013-10')?.remaining).toBe(9);
  });
});

describe('nextAvailableDate', () => {
  it('is the first day with capacity', async () => {
    expect(await svc.nextAvailableDate({ ...area, fromDate: new Date(clock) })).toEqual(new Date('2026-10-12T00:00:00Z'));
  });

  it('when the day is full: the next day', async () => {
    for (const hour of [10, 12, 14, 16, 18]) {
      for (let i = 0; i < 10; i++) await svc.holdSlot(`20261012-${hour}`, `c-${hour}-${i}`, 15);
    }
    expect(await svc.nextAvailableDate({ ...area, fromDate: new Date(clock) })).toEqual(new Date('2026-10-13T00:00:00Z'));
  });

  it('null when nothing is available in the horizon', async () => {
    for (let d = 12; d <= 18; d++) {
      for (const hour of SLOT_CONFIG.windows) {
        for (let i = 0; i < 10; i++) await svc.confirmBooking(`202610${d}-${String(hour).padStart(2, '0')}`, `o-${d}-${hour}-${i}`);
      }
    }
    expect(await svc.nextAvailableDate({ ...area, fromDate: new Date(clock) })).toBeNull();
  });
});
