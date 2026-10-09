// Absolute URLs for canonical links, hreflang alternates, the sitemap and robots.
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/lib/utils';

const FALLBACK_SITE_URL = 'http://localhost:3000';

/** Public origin without a trailing slash: `SITE_URL` when set (production), else a local default. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.SITE_URL ?? '').trim();
  if (!/^https?:\/\/[^\s/]+/.test(raw)) return FALLBACK_SITE_URL;
  return raw.replace(/\/+$/, '');
}

/** Absolute URL of a locale-less path under a locale (`/faq` -> https://host/en-US/faq). */
export function absoluteUrl(locale: string, path: string, origin: string = siteUrl()): string {
  const clean = path === '/' ? '' : `/${path.replace(/^\/+|\/+$/g, '')}`;
  return `${origin}/${locale}${clean}`;
}

/** hreflang map for a path across every supported locale, plus x-default. */
export function languageAlternates(path: string, origin: string = siteUrl()): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) languages[locale] = absoluteUrl(locale, path, origin);
  languages['x-default'] = absoluteUrl(DEFAULT_LOCALE, path, origin);
  return languages;
}

/** Title, description, absolute canonical and hreflang alternates for a static page. */
export function pageMetadata(input: { locale: string; path: string; title: string; description?: string; noindex?: boolean }): Metadata {
  const { locale, path, title, description, noindex } = input;
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: absoluteUrl(locale, path), languages: languageAlternates(path) },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
