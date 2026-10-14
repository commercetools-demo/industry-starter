// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure opening-hours and pickup logic. Uses Intl with the IANA zone; no date library. Safe on server and client.
import type { Branch, HoursState, PickupOption, Weekday } from '@/lib/types';

const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Weekday and minutes since local midnight of `now` in the IANA zone. */
function localParts(now: Date, timezone: string): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday').toLowerCase().slice(0, 3) as Weekday;
  return { day: DAYS.includes(day) ? day : 'mon', minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** First opening time on the days after `day` (up to a week ahead), or `null` when the branch never opens. */
function nextOpening(branch: Branch, day: Weekday): string | null {
  const start = DAYS.indexOf(day);
  for (let i = 1; i <= 7; i += 1) {
    const hours = branch.hours[DAYS[(start + i) % 7]];
    if (hours) return hours[0];
  }
  return null;
}

/** Open now (with closing time) or closed (with the next opening time). The branch timezone wins over `timezone`. */
export function getHoursState(branch: Branch, now: Date, timezone: string): HoursState {
  const { day, minutes } = localParts(now, branch.timezone || timezone);
  const today = branch.hours[day];
  if (today) {
    if (minutes < minutesOf(today[0])) return { open: false, opensAt: today[0], opensToday: true };
    if (minutes < minutesOf(today[1])) return { open: true, closesAt: today[1] };
  }
  return { open: false, opensAt: nextOpening(branch, day), opensToday: false };
}

/** `ship-to-store` and `next-day` are fixed; `same-day` is today while the branch is open or opens later today, else tomorrow. */
export function getPickupOption(branch: Branch, now: Date, timezone: string): PickupOption {
  if (branch.pickupMode === 'ship-to-store') return 'ship-to-store';
  if (branch.pickupMode === 'next-day') return 'tomorrow';
  const state = getHoursState(branch, now, timezone);
  return state.open || state.opensToday ? 'today' : 'tomorrow';
}
