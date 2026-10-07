import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';
import { FALLBACK_LOCALE, type ContentLocale } from './types';

export function absoluteUrl(locale: ContentLocale, pathname: string): string {
  return `${SITE_URL}/${locale}${pathname}`;
}

/**
 * Metadata of a content page. A page served in English under a German URL is `noindex` and canonicalises to the
 * English address, so duplicate English text is never indexed under /de-DE.
 */
export function contentMetadata(args: {
  title: string;
  description: string;
  locale: ContentLocale;
  pathname: string;
  fallback: boolean;
}): Metadata {
  const { title, description, locale, pathname, fallback } = args;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(fallback ? FALLBACK_LOCALE : locale, pathname) },
    ...(fallback ? { robots: { index: false, follow: true } } : {}),
  };
}
