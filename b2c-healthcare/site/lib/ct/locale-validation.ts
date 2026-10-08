import 'server-only';
import { COUNTRY_CONFIG, type AppLocale, type CountryConfig } from '@/lib/utils';
import { getProjectSettings, type ProjectSettings } from '@/lib/ct/project';

export type ValidCountryConfig = Partial<Record<AppLocale, CountryConfig>>;

/** True when the project enables the entry's country, currency and language (tag or base language). */
export function isRegionEnabled(locale: string, config: CountryConfig, settings: ProjectSettings): boolean {
  const languages = settings.languages.map((l) => l.toLowerCase());
  return (
    settings.countries.includes(config.country) &&
    settings.currencies.includes(config.currency) &&
    (languages.includes(locale.toLowerCase()) || languages.includes(config.language.toLowerCase()))
  );
}

/**
 * COUNTRY_CONFIG filtered against the project settings (cached 300 s in getProjectSettings):
 * a region the project cannot price or sell is excluded.
 */
export async function getValidCountryConfig(): Promise<ValidCountryConfig> {
  const settings = await getProjectSettings();
  const out: ValidCountryConfig = {};
  for (const [locale, config] of Object.entries(COUNTRY_CONFIG) as [AppLocale, CountryConfig][]) {
    if (isRegionEnabled(locale, config, settings)) out[locale] = config;
  }
  return out;
}
