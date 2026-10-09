import { COUNTRY_CONFIG } from './utils';

/** The locale-dependent fields of a session. They change together or not at all. */
export interface LocaleFields {
  locale: string;
  currency: string;
  country: string;
}

export interface SessionWithLocale extends LocaleFields {
  cartId?: string;
}

/**
 * Atomic locale write (malva-locale-routing › Atomic locale write): all three fields or an error, and the cart is
 * dropped when the currency changes because a cart cannot change currency. Returns a new object.
 */
export function applyLocale<T extends SessionWithLocale>(session: T, next: Partial<LocaleFields>): T {
  const { locale, currency, country } = next;
  if (!locale || !currency || !country) throw new Error('applyLocale needs locale, currency and country together');
  const config = COUNTRY_CONFIG[locale];
  if (!config) throw new Error(`Unsupported locale "${locale}"`);
  if (config.currency !== currency || config.country !== country) throw new Error(`Locale ${locale} uses ${config.country}/${config.currency}, not ${country}/${currency}`);
  const updated: T = { ...session, locale, currency, country };
  if (session.currency !== currency) delete updated.cartId;
  return updated;
}
