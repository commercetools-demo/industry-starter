import { parseDateOnly } from '@/lib/pricing/dates';
import type { Locale } from '@/lib/types';

/** A date-only value (`YYYY-MM-DD`, or an ISO date-time cut to the day) as a long date in the buyer's locale, read in UTC. */
export function formatDeviceDate(isoDate: string, locale: Locale): string {
  const date = parseDateOnly(isoDate.slice(0, 10));
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date) : isoDate;
}

/** The Date of a `YYYY-MM-DD` day at midnight UTC (the "today" a card was rendered for). Falls back to now for a bad value. */
export function dayToDate(isoDate: string): Date {
  return parseDateOnly(isoDate) ?? new Date();
}
