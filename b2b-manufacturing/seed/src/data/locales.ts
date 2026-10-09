/** Launch locales (owner, Q-012). Language, country and currency travel together per locale. */
export const LOCALES = [
  { locale: 'en-US', country: 'US', currency: 'USD' },
  { locale: 'de-DE', country: 'DE', currency: 'EUR' },
] as const;

export const LANGUAGES = LOCALES.map((x) => x.locale);
export const COUNTRIES = LOCALES.map((x) => x.country);
export const CURRENCIES = LOCALES.map((x) => x.currency);

/** A localized string with an English and a German text. When no German text is given, English is used. */
export const ls = (en: string, de: string = en): Record<string, string> => ({ 'en-US': en, 'de-DE': de });
