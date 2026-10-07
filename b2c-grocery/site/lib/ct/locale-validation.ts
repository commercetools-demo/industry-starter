import 'server-only';
import { unstable_cache } from 'next/cache';
import { COUNTRY_CONFIG, type CountryConfig } from '../utils';
import { getApiRoot } from './client';

export const LOCALE_VALIDATION_REVALIDATE_SECONDS = 300;

interface ProjectLocaleSettings { countries: string[]; currencies: string[]; languages: string[] }

/** Public project settings, identical for every visitor, so it is safe to share through `unstable_cache`. */
const getProjectLocaleSettings = unstable_cache(
  async (): Promise<ProjectLocaleSettings> => {
    const { body } = await getApiRoot().get().execute();
    return { countries: body.countries, currencies: body.currencies, languages: body.languages };
  },
  ['project-locale-settings'],
  { revalidate: LOCALE_VALIDATION_REVALIDATE_SECONDS },
);

/** `COUNTRY_CONFIG` entries whose country, currency and language are all enabled in the commercetools project. */
export async function getValidCountryConfig(): Promise<Record<string, CountryConfig>> {
  const settings = await getProjectLocaleSettings();
  return Object.fromEntries(
    Object.entries(COUNTRY_CONFIG).filter(
      ([, c]) => settings.countries.includes(c.country) && settings.currencies.includes(c.currency) && settings.languages.includes(c.locale),
    ),
  );
}

/** The markets a shopper may select. */
export async function getValidMarkets(): Promise<CountryConfig[]> {
  return Object.values(await getValidCountryConfig());
}
