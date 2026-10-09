import 'server-only';
import { getValidCountryConfig } from '@/lib/ct/locale-validation';
import type { RegionOption } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

/** "United States, English (USD)" in the language of the page, from the region table only. */
function labelOf(uiLocale: string, config: { country: string; currency: string; language: string }): string {
  const region = new Intl.DisplayNames([uiLocale], { type: 'region' }).of(config.country) ?? config.country;
  const language = new Intl.DisplayNames([uiLocale], { type: 'language' }).of(config.language) ?? config.language;
  return `${region}, ${language} (${config.currency})`;
}

/**
 * The regions the header switcher offers: COUNTRY_CONFIG filtered by the project (a region the project cannot price
 * or sell is excluded). With fewer than two the switcher is not shown, so a single-region shop (v1) never asks the
 * project anything here, and a failing project read hides the switcher instead of breaking every page.
 */
export async function getSwitchableRegions(uiLocale: string): Promise<RegionOption[]> {
  if (Object.keys(COUNTRY_CONFIG).length < 2) return [];
  try {
    const valid = Object.entries(await getValidCountryConfig());
    if (valid.length < 2) return [];
    return valid.map(([locale, config]) => ({ locale, label: labelOf(uiLocale, config) }));
  } catch {
    return [];
  }
}
