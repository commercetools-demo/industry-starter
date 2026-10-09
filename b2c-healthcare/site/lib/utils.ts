// Region table and locale/money helpers (storefront-locale-routing).
// COUNTRY_CONFIG is the only place country, currency and language values appear.

export interface CountryConfig {
  /** ISO 3166-1 alpha-2 country code. */
  readonly country: string;
  /** ISO 4217 currency code. */
  readonly currency: string;
  /** ISO 639-1 language code. */
  readonly language: string;
}

export const COUNTRY_CONFIG = {
  'en-US': { country: 'US', currency: 'USD', language: 'en' },
} as const satisfies Record<string, CountryConfig>;

export type AppLocale = keyof typeof COUNTRY_CONFIG;

export const SUPPORTED_LOCALES = Object.keys(COUNTRY_CONFIG) as AppLocale[];

export const DEFAULT_LOCALE: AppLocale = 'en-US';

/** Cookie that remembers the visitor's region choice. */
export const LOCALE_COOKIE = 'your-shop-country-locale';

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COUNTRY_CONFIG, value);
}

/** commercetools LocalizedString shape (language/locale tag to text). */
export type LocalizedField = Readonly<Record<string, string>> | null | undefined;

/**
 * Picks text from a localized field. Order: exact locale, language, default locale, first value.
 * Returns '' for a missing or empty field.
 */
export function getLocalizedString(field: LocalizedField, locale: string): string {
  if (!field) return '';
  const language = locale.split('-')[0] ?? locale;
  for (const key of [locale, language, DEFAULT_LOCALE]) {
    const value = field[key];
    if (value) return value;
  }
  return Object.values(field).find((value) => Boolean(value)) ?? '';
}

/**
 * Formats a commercetools minor-unit amount. The number of fraction digits comes from the currency
 * (Intl), never from a hard-coded division by 100.
 */
export function formatMoney(centAmount: number, currencyCode: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
  const digits = formatter.resolvedOptions().minimumFractionDigits ?? 2;
  return formatter.format(centAmount / 10 ** digits);
}
