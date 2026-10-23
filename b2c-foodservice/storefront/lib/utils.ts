import type { LocaleKey } from '@/lib/types';

export type { LocaleKey };

export interface CountryConfig {
  locale: string;
  currency: string;
  country: string;
  label: string;
  /** Per-market flag: collection in store is offered (US only; Canada is delivery only, D-035). */
  collection: boolean;
  /** IANA time zone for store opening hours (Q-F-10). */
  timeZone: string;
}

/** The one source for markets: routing, message files and the proxy derive from these keys (D-030). */
export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States', collection: true, timeZone: 'America/New_York' },
  'en-CA': { locale: 'en-CA', currency: 'CAD', country: 'CA', label: 'Canada', collection: false, timeZone: 'America/Toronto' },
};

export const DEFAULT_LOCALE: CountryConfig = COUNTRY_CONFIG['en-US'];

/** The only cookie name for the chosen market. */
export const LOCALE_COOKIE = 'malva-locale';

export function isLocaleKey(value: unknown): value is LocaleKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COUNTRY_CONFIG, value);
}

export function marketForLocale(locale: string): CountryConfig {
  return isLocaleKey(locale) ? COUNTRY_CONFIG[locale] : DEFAULT_LOCALE;
}

export function marketForCountry(country: string): CountryConfig | undefined {
  return Object.values(COUNTRY_CONFIG).find((m) => m.country === country);
}

/** Integer minor units to a display string. The divisor comes from Intl, so 495 USD is $4.95. */
export function formatMoney(centAmount: number, currencyCode: string, locale = 'en-US'): string {
  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(centAmount / 10 ** digits);
}

/** Display rounding only (one decimal); the raw average is never rounded in data. */
export function roundRating(average: number): number {
  return Math.round(average * 10) / 10;
}

/** exact key, same language, DEFAULT_LOCALE key, first value, empty. Server-side (lib/ct, lib/mappers) only. */
export function getLocalizedString(obj: Record<string, string> | undefined, locale: string): string {
  if (!obj) return '';
  if (obj[locale] !== undefined) return obj[locale];
  const lang = locale.split('-')[0].toLowerCase();
  const same = Object.keys(obj).find((k) => k.split('-')[0].toLowerCase() === lang);
  if (same !== undefined) return obj[same];
  return obj[DEFAULT_LOCALE.locale] ?? Object.values(obj)[0] ?? '';
}
