import type { OpeningHours, Weekday } from '@/lib/types';

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const CLOSED_ALL_WEEK: OpeningHours = {
  mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
};

/** The weekday in the store's own time zone, so a shopper elsewhere sees the store's today. */
export function weekdayIn(now: Date, timeZone: string): Weekday {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(now).toLowerCase();
  return short.slice(0, 3) as Weekday;
}

/** Today's opening window for a store, or null when it is closed today. */
export function todayHours(
  store: { hours: OpeningHours },
  now: Date,
  timeZone: string,
): { open: string; close: string } | null {
  return store.hours[weekdayIn(now, timeZone)] ?? null;
}
