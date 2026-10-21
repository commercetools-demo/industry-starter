import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { COUNTRY_CONFIG, type CountryConfig } from '@/lib/utils';

/** The configured markets that the commercetools project actually supports. */
export async function fetchMarkets(): Promise<CountryConfig[]> {
  const { body } = await apiRoot.get().execute();
  const countries = new Set(body.countries);
  const currencies = new Set(body.currencies);
  const languages = new Set(body.languages.map((l) => l.toLowerCase()));
  return Object.values(COUNTRY_CONFIG).filter(
    (m) => countries.has(m.country) && currencies.has(m.currency) && languages.has(m.locale.toLowerCase()),
  );
}

export const getMarkets: () => Promise<CountryConfig[]> = cachedPublic('project', ['markets'], fetchMarkets);
