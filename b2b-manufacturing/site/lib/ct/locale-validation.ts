import 'server-only';
import { unstable_cache } from 'next/cache';
import { COUNTRY_CONFIG, type CountryConfig } from '../utils';

/** The parts of the commercetools Project that decide which locales can be served. */
export interface ProjectSettings {
  countries: string[];
  currencies: string[];
  languages: string[];
}

/** Only the configured locales whose country, currency and language the project lists. */
export function supportedLocales(project: ProjectSettings, config: Record<string, CountryConfig> = COUNTRY_CONFIG): CountryConfig[] {
  return Object.values(config).filter((c) => project.countries.includes(c.country) && project.currencies.includes(c.currency) && project.languages.includes(c.locale));
}

export const LOCALE_VALIDATION_REVALIDATE_SECONDS = 300;

/** Cached for five minutes so a request never waits on the Project endpoint. `readProject` is the SDK call (workstream D). */
export function getSupportedLocales(readProject: () => Promise<ProjectSettings>): Promise<CountryConfig[]> {
  return unstable_cache(async () => supportedLocales(await readProject()), ['locale-validation'], { revalidate: LOCALE_VALIDATION_REVALIDATE_SECONDS })();
}
