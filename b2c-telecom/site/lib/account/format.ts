import type { Locale } from '@/lib/types';

// Dates of the account pages. Everything is formatted in UTC: a date-only value (`serviceStartDate`) must not shift with the viewer's
// time zone, and the server and the browser must print the same text.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: string): Date | null {
  const date = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `Mar 12, 2026` / `12.03.2026` (`dateStyle: 'medium'`); the input unchanged when it is not a date. */
export function formatDate(value: string, locale: Locale): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date) : value;
}

/** Date and time (`timeStyle: 'short'`) of an order. */
export function formatDateTime(value: string, locale: Locale): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date) : value;
}
