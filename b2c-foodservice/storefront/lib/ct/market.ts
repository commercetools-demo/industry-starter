import 'server-only';
import { getMarkets } from '@/lib/ct/project';
import type { MarketOption } from '@/lib/types';
import { COUNTRY_CONFIG, type CountryConfig } from '@/lib/utils';

/** Language label shown in the chooser. One per market today (D-030); more is a data change. */
const LANGUAGE_LABEL = 'English';

export function toMarketOptions(markets: CountryConfig[]): MarketOption[] {
  const byCountry = new Map<string, MarketOption>();
  for (const m of markets) {
    const existing = byCountry.get(m.country);
    const language = { locale: m.locale, label: LANGUAGE_LABEL };
    if (existing) existing.languages.push(language);
    else {
      byCountry.set(m.country, {
        country: m.country, currency: m.currency, locale: m.locale, label: m.label,
        languages: [language], region: 'North America',
      });
    }
  }
  return [...byCountry.values()];
}

/**
 * The markets the chooser offers: COUNTRY_CONFIG entries that the commercetools project supports (countries,
 * currencies, languages), cached 300 s by D's `getMarkets`. If the project call fails the full configuration is
 * used and the failure is logged, so the shell never breaks.
 */
export async function getValidCountryConfig(): Promise<MarketOption[]> {
  try {
    const valid = await getMarkets();
    if (valid.length > 0) return toMarketOptions(valid);
    console.error(JSON.stringify({ event: 'markets_empty_fallback' }));
  } catch (e) {
    console.error(JSON.stringify({ event: 'markets_failed_fallback', status: (e as { statusCode?: number })?.statusCode }));
  }
  return toMarketOptions(Object.values(COUNTRY_CONFIG));
}

/**
 * The CountryConfig for a country that the project supports, or undefined. With `locale` it must be one of that
 * country's languages (a language-only change keeps the country); without it the country's first language is used.
 */
export async function validateMarket(country: string, locale?: string): Promise<CountryConfig | undefined> {
  const options = await getValidCountryConfig();
  const option = options.find((o) => o.country === country);
  if (!option) return undefined;
  if (locale === undefined) return COUNTRY_CONFIG[option.locale];
  return option.languages.some((l) => l.locale === locale) ? COUNTRY_CONFIG[locale] : undefined;
}
