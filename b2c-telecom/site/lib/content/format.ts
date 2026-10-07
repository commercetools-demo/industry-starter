import type { ContentLocale } from './types';

/** `YYYY-MM-DD` to a long date in the reader's locale; always UTC so the day never shifts. */
export function formatDate(iso: string, locale: ContentLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

/** The calendar day before `YYYY-MM-DD` (the last day an older policy version was in force). */
export function dayBefore(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
