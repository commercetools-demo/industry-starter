import type { LocaleKey } from '@/lib/types';

/** Text that exists in the fallback language and, optionally, in the other storefront locales. */
export type Localized<T> = { 'en-US': T } & Partial<Record<Exclude<LocaleKey, 'en-US'>, T>>;

export interface Resolved<T> {
  value: T;
  usedLocale: LocaleKey;
  isFallback: boolean;
}

/** Fallback chain: the requested locale, then en-US (the storefront's fallback language). */
export function resolveLocalized<T>(content: Localized<T>, locale: string): Resolved<T> {
  const own = (content as Partial<Record<string, T>>)[locale];
  if (own !== undefined) return { value: own, usedLocale: locale as LocaleKey, isFallback: false };
  return { value: content['en-US'], usedLocale: 'en-US', isFallback: locale !== 'en-US' };
}

/** True when the locale has its own text (used for hreflang alternates and the sitemap). */
export function hasOwnText<T>(content: Localized<T>, locale: string): boolean {
  return (content as Partial<Record<string, T>>)[locale] !== undefined;
}
