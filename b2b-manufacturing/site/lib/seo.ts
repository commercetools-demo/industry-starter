import type { Metadata, MetadataRoute } from 'next';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALES } from './utils';

export const SITE_NAME = 'Malva Plumbing & Waste Management';

/**
 * Absolute origin for canonical, hreflang, sitemap and JSON-LD: `SITE_URL` (non-secret), else the Netlify deploy URL, else a placeholder.
 * It never comes from the request host, so previews and crawlers see stable values.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.SITE_URL || env.DEPLOY_PRIME_URL || env.URL || 'https://www.malva.example').replace(/\/$/, '');
}

export const absoluteUrl = (locale: string, path = ''): string => `${siteUrl()}/${locale}${path === '/' ? '' : path}`;

/** hreflang map for one page: every launch locale plus `x-default` (the default locale). `path` has no locale prefix. */
export function alternateLanguages(path = ''): Record<string, string> {
  return { ...Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(l, path)])), 'x-default': absoluteUrl(DEFAULT_LOCALE, path) };
}

/** Title (≤ 60 characters) and description (≤ 160) are the page's own; everything else is derived so pages cannot disagree. */
export function pageMetadata({ locale, title, description, path = '', noindex, image }: { locale: string; title: string; description: string; path?: string; noindex?: boolean; image?: string }): Metadata {
  const url = absoluteUrl(locale, path);
  // Pages without their own photo use the generated social card of the locale.
  const images = image ? [{ url: image }] : [{ url: `${absoluteUrl(locale)}/opengraph-image`, width: 1200, height: 630 }];
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: alternateLanguages(path) },
    openGraph: { title, description, url, siteName: SITE_NAME, locale: COUNTRY_CONFIG[locale]?.locale ?? locale, type: 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Organization structured data. Real phone and address await SO-04; only confirmed values are included. */
export function organizationJsonLd(phone: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: siteUrl(),
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer service', telephone: phone, availableLanguage: ['en', 'de'] }],
  };
}

export type SitemapEntry = MetadataRoute.Sitemap[number];
