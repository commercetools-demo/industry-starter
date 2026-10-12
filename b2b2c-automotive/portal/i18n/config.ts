export const LOCALES = ['de-DE', 'en-US'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE_KEY: AppLocale = 'de-DE';
export const LOCALE_COOKIE = 'your-shop-country-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const isAppLocale = (v: unknown): v is AppLocale =>
  typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
