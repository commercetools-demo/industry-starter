// Formatting of money and dates for workstream V's screens (locale from next-intl; the currency comes from the data, never a constant).
export const money = (cents: number, currency: string, locale: string): string => new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(cents / 100);

export const shortDate = (iso: string | null | undefined, locale: string): string => (iso ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso)) : '-');

/** "Anna M." style initials are done on the server; this is for the stars text only. */
export const oneDecimal = (value: number, locale: string): string => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
