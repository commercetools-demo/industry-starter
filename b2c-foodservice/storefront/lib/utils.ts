export interface CountryConfig {
  locale: string;
  currency: string;
  country: string;
  label: string;
}

/** The one source for markets: routing, message files and the proxy derive from these keys (D-030). */
export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States' },
  'en-CA': { locale: 'en-CA', currency: 'CAD', country: 'CA', label: 'Canada' },
};

export const DEFAULT_LOCALE: CountryConfig = COUNTRY_CONFIG['en-US'];

/** The only cookie name for the chosen market. */
export const LOCALE_COOKIE = 'malva-locale';

export function formatMoney(centAmount: number, currencyCode: string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })
    .format(centAmount / 100);
}

export function getLocalizedString(obj: Record<string, string> | undefined, locale: string): string {
  if (!obj) return '';
  return obj[locale] ?? obj[locale.split('-')[0]] ?? Object.values(obj)[0] ?? '';
}
