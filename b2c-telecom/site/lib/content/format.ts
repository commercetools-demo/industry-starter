import type { ContentLocale } from './types';

/** `YYYY-MM-DD` to a long date in the reader's locale; always UTC so the day never shifts. */
export function formatDate(iso: string, locale: ContentLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}
