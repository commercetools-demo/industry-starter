import type { MetadataRoute } from 'next';
import { contentSitemapEntries } from '@/lib/routes';
import { absoluteUrl, languageAlternates } from '@/lib/seo';
import { SUPPORTED_LOCALES } from '@/lib/utils';

/** Absolute URLs with hreflang alternates for the home page, the static pages and every published article. */
export function buildSitemap(origin?: string): MetadataRoute.Sitemap {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    [{ path: '/' }, ...contentSitemapEntries(locale)].map(({ path, lastModified }) => ({
      url: absoluteUrl(locale, path, origin),
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages: languageAlternates(path, origin) },
    })),
  );
}

/** Private, session-bound and API routes stay out of search indexes. */
export const PRIVATE_PATHS = ['/api/', '/*/account', '/*/cart', '/*/checkout', '/*/order', '/*/login', '/*/prescriptions'];

export function buildRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: `${origin}/sitemap.xml`,
  };
}
