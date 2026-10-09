/** Long date for an ISO yyyy-mm-dd string, in the visitor's locale and independent of the server time zone. */
export function formatIsoDate(iso: string, locale: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
