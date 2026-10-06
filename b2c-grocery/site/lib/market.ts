import { getMarket } from './session';
import { COUNTRY_CONFIG } from './utils';

/** The market follows the URL locale (D-012: one market per locale); the session only supplies a fallback (see Q-K-1). */
export async function marketFor(locale: string): Promise<{ country: string; currency: string; locale: string }> {
  const config = COUNTRY_CONFIG[locale];
  if (config) return { country: config.country, currency: config.currency, locale };
  return { ...(await getMarket()), locale };
}
