// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Branch } from '@/lib/types';
import { getHoursState, getPickupOption } from './pickup';

const week = (open: [string, string], sat?: [string, string]): Branch['hours'] => ({ mon: open, tue: open, wed: open, thu: open, fri: open, ...(sat ? { sat } : {}) });
const branch = (over: Partial<Branch> = {}): Branch => ({
  key: 'mau-br-north-hamburg',
  channelId: 'c1',
  name: 'Hamburg',
  address: { street: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg' },
  hours: week(['08:00', '19:00'], ['09:00', '14:00']),
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
  ...over,
});
const TZ = 'Europe/Berlin';

describe('Closed store: hours state', () => {
  it('open branch says open until', () => {
    // Wed 2026-06-10 10:00 CEST
    expect(getHoursState(branch(), new Date('2026-06-10T08:00:00Z'), TZ)).toEqual({ open: true, closesAt: '19:00' });
  });
  it('closed branch states when it opens', () => {
    // Wed 06:00 CEST, opens today at 08:00
    expect(getHoursState(branch(), new Date('2026-06-10T04:00:00Z'), TZ)).toEqual({ open: false, opensAt: '08:00', opensToday: true });
    // Wed 20:00 CEST, opens tomorrow
    expect(getHoursState(branch(), new Date('2026-06-10T18:00:00Z'), TZ)).toEqual({ open: false, opensAt: '08:00', opensToday: false });
  });
  it('missing day is closed', () => {
    // Sun 2026-06-14 12:00 CEST: closed, next opening Monday 08:00
    expect(getHoursState(branch(), new Date('2026-06-14T10:00:00Z'), TZ)).toEqual({ open: false, opensAt: '08:00', opensToday: false });
  });
  it('a branch with no hours at all is closed with no opening time', () => {
    expect(getHoursState(branch({ hours: {} }), new Date('2026-06-10T08:00:00Z'), TZ)).toEqual({ open: false, opensAt: null, opensToday: false });
  });
  it('the branch timezone wins over the store timezone', () => {
    // Austin: Wed 2026-06-10 13:00Z is 08:00 CDT (open), but 15:00 in Berlin.
    const austin = branch({ timezone: 'America/Chicago', hours: week(['08:00', '18:00']) });
    expect(getHoursState(austin, new Date('2026-06-10T13:00:00Z'), TZ)).toEqual({ open: true, closesAt: '18:00' });
  });
  it('DST day does not shift the result', () => {
    // Europe/Berlin switches to CEST on 2026-03-29. Mon 2026-03-30 06:30Z is 08:30 CEST: open.
    expect(getHoursState(branch(), new Date('2026-03-30T06:30:00Z'), TZ)).toEqual({ open: true, closesAt: '19:00' });
    // 06:30Z on Sat 2026-03-28 is 07:30 CET (Saturday opens 09:00).
    expect(getHoursState(branch(), new Date('2026-03-28T06:30:00Z'), TZ)).toEqual({ open: false, opensAt: '09:00', opensToday: true });
  });
});

describe('Closed store: pickup option', () => {
  it('same-day branch that is open says today', () => {
    expect(getPickupOption(branch(), new Date('2026-06-10T08:00:00Z'), TZ)).toBe('today');
  });
  it('same-day branch that opens later today says today', () => {
    expect(getPickupOption(branch(), new Date('2026-06-10T04:00:00Z'), TZ)).toBe('today');
  });
  it('closed for the rest of today returns tomorrow', () => {
    expect(getPickupOption(branch(), new Date('2026-06-10T18:00:00Z'), TZ)).toBe('tomorrow');
  });
  it('next-day mode returns tomorrow', () => {
    expect(getPickupOption(branch({ pickupMode: 'next-day' }), new Date('2026-06-10T08:00:00Z'), TZ)).toBe('tomorrow');
  });
  it('ship-to-store mode', () => {
    expect(getPickupOption(branch({ pickupMode: 'ship-to-store' }), new Date('2026-06-10T08:00:00Z'), TZ)).toBe('ship-to-store');
  });
});
