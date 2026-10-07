export type Market = { locale: 'en-US' | 'de-DE'; currency: 'USD' | 'EUR'; country: 'US' | 'DE' };
export type CountryConfig = Market & { label: string };

export const COUNTRY_CONFIG: Record<Market['locale'], CountryConfig> = {
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States' },
  'de-DE': { locale: 'de-DE', currency: 'EUR', country: 'DE', label: 'Deutschland' },
};

export const LOCALES = Object.keys(COUNTRY_CONFIG) as Market['locale'][];
export const DEFAULT_LOCALE = 'en-US' as const;
/** Value: a locale string. httpOnly, sameSite lax, path /, maxAge 31536000, secure in production. */
export const MARKET_COOKIE = 'malva-market';
export const MARKET_COOKIE_MAX_AGE = 31536000;

export function isSupportedLocale(value: unknown): value is Market['locale'] {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COUNTRY_CONFIG, value);
}

export function marketFor(locale: string): Market {
  const config = isSupportedLocale(locale) ? COUNTRY_CONFIG[locale] : COUNTRY_CONFIG[DEFAULT_LOCALE];
  return { locale: config.locale, currency: config.currency, country: config.country };
}
