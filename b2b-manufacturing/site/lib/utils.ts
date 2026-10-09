/** The only place that knows which locales exist (malva-locale-routing › Single source of truth). */
export interface CountryConfig {
  locale: string;
  country: string;
  currency: string;
  /** Name of the language in its own language, for the switcher. */
  label: string;
}

export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  'en-US': { locale: 'en-US', country: 'US', currency: 'USD', label: 'English (US)' },
  'de-DE': { locale: 'de-DE', country: 'DE', currency: 'EUR', label: 'Deutsch (DE)' },
};

export const LOCALES = Object.keys(COUNTRY_CONFIG) as [string, ...string[]];
export const DEFAULT_LOCALE = 'en-US';
export const LOCALE_COOKIE = 'your-shop-country-locale';

export const isSupportedLocale = (value: unknown): value is string => typeof value === 'string' && Object.hasOwn(COUNTRY_CONFIG, value);

/** Formats an amount. Services never show prices (D12, D21); this exists for later use. */
export function formatMoney(centAmount: number, currencyCode: string, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(centAmount / 100);
}

/** Picks a localized string: exact locale, its language, the default locale, then any value. Never throws. */
export function getLocalizedString(field: Record<string, string> | null | undefined, locale: string): string {
  if (!field) return '';
  const language = locale.split('-')[0] ?? locale;
  const byLanguage = Object.entries(field).find(([key]) => key.split('-')[0] === language)?.[1];
  return field[locale] ?? byLanguage ?? field[DEFAULT_LOCALE] ?? Object.values(field)[0] ?? '';
}

/**
 * Stored image URLs are clean originals (no query). At render time photos from the image host are asked for the width the slot needs,
 * so a 5000 px original is never sent to a phone. Other hosts are returned unchanged.
 */
export function sizedImage(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (u.hostname !== 'images.pexels.com') return url;
    return `${u.origin}${u.pathname}?auto=compress&cs=tinysrgb&w=${width}`;
  } catch {
    return url;
  }
}

/** `srcset` for a stored photo: the same image at several widths, so a phone never downloads the desktop size. Undefined for other hosts. */
export function srcSetFor(url: string, widths: number[]): string | undefined {
  const sized = widths.map((w) => [sizedImage(url, w), w] as const);
  return sized.every(([u]) => u === url) ? undefined : sized.map(([u, w]) => `${u} ${w}w`).join(', ');
}
