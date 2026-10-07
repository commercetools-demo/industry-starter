import type { Locale, Market } from '@/lib/types';

/** D-004: en-US/USD/US and de-DE/EUR/DE; en-GB/GBP is deliberately absent. */
export const MARKETS: Record<Locale, Market> = {
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US' },
  'de-DE': { locale: 'de-DE', currency: 'EUR', country: 'DE' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MARKETS, value);
}

export function marketFromLocale(locale: string): Market {
  if (!isLocale(locale)) throw new Error('Unsupported locale');
  return MARKETS[locale];
}
