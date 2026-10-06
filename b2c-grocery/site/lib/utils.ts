export type CountryConfig = { locale: string; currency: string; country: string; label: string };

/** The only place a locale, currency or country is hard-coded. Add a market here and in messages/<locale>.json. */
export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  'en-US': { locale: 'en-US', currency: 'USD', country: 'US', label: 'United States' },
  'de-DE': { locale: 'de-DE', currency: 'EUR', country: 'DE', label: 'Deutschland' },
};
export const DEFAULT_LOCALE: CountryConfig = COUNTRY_CONFIG['en-US'];
export const LOCALE_COOKIE = 'your-shop-country-locale';

/** The only place that divides cent amounts by 100 (two fraction digits currencies only). */
export function formatMoney(centAmount: number, currencyCode: string, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(centAmount / 100);
}

/** Exact locale, then language only (`en`), then the first value, then ''. */
export function getLocalizedString(obj: Record<string, string> | undefined, locale: string): string {
  if (!obj) return '';
  if (obj[locale]) return obj[locale];
  const language = locale.split('-')[0];
  const byLanguage = Object.keys(obj).find((k) => k.split('-')[0] === language && obj[k]);
  if (byLanguage) return obj[byLanguage];
  return Object.values(obj).find(Boolean) ?? '';
}
