import type { MetadataRoute } from 'next';
import { BRAND_SLUGS, type BrandSlug } from '@/lib/brands';
import { ABOUT } from '@/content/about';
import { ARTICLES } from '@/content/journal';
import { POLICIES } from '@/content/policies';
import { hasOwnText } from '@/lib/content/localized';
import { ownLocalesOf, publishedArticles } from '@/lib/content/journal';
import type { Article } from '@/lib/content/journal-types';
import { POLICY_SLUGS, aboutHref, articleHref, contactHref, faqHref, journalHref, policyHref } from '@/lib/routes';

/** Content pages for every locale. Withdrawn articles are never listed. Product and category entries are parked in IDEAS.md. */
export function buildSitemap(origin: string, locales: readonly string[], articles: Article[] = ARTICLES, brands: readonly BrandSlug[] = BRAND_SLUGS): MetadataRoute.Sitemap {
  return brands.flatMap((brand) => buildBrandSitemap(origin, brand, locales, articles));
}

function buildBrandSitemap(origin: string, brand: BrandSlug, locales: readonly string[], articles: Article[]): MetadataRoute.Sitemap {
  const entry = (path: string, own: readonly string[], lastModified?: string): MetadataRoute.Sitemap =>
    locales.map((locale) => ({
      url: `${origin}/${brand}/${locale}${path}`,
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages: Object.fromEntries(own.map((l) => [l, `${origin}/${brand}/${l}${path}`])) },
    }));

  return [
    ...locales.map((locale) => ({
      url: `${origin}/${brand}/${locale}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${origin}/${brand}/${l}`])) },
    })),
    ...entry(aboutHref(), locales.filter((l) => hasOwnText(ABOUT, l))),
    ...entry(contactHref(), locales),
    ...entry(faqHref(), ['en-US']),
    ...POLICY_SLUGS.flatMap((slug) =>
      entry(
        policyHref(slug),
        locales.filter((l) => hasOwnText(POLICIES[slug], l)),
        POLICIES[slug]['en-US'].effectiveDate,
      ),
    ),
    ...entry(journalHref(), locales),
    ...publishedArticles(articles).flatMap((a) => entry(articleHref(a.slug), ownLocalesOf(a, locales), a.updatedAt ?? a.publishedAt)),
  ];
}
