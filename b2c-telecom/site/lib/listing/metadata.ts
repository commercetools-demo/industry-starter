import type { Metadata } from 'next';
import { canonicalListingPath, languageAlternates } from '@/lib/listing/links';
import type { Category, Locale } from '@/lib/types';

/**
 * SEO of one listing page. The canonical URL is the listing itself plus `?page=N` for N > 1: filters, sort and the `offer` anchor are
 * not part of it, so every variant of a listing points at one address. `hreflang` alternates carry each locale's own slug.
 */
export function buildListingMetadata(input: {
  locale: Locale;
  category: Category;
  /** The page that is really shown (already clamped). */
  page: number;
  title: string;
  description: string;
  siteUrl: string;
}): Metadata {
  const { locale, category, page, title, description, siteUrl } = input;
  const slug = category.slugs[locale] ?? category.slug;
  const absolute = (path: string): string => `${siteUrl}${path}`;
  return {
    title,
    description: description.length > 160 ? `${description.slice(0, 157)}...` : description,
    alternates: {
      canonical: absolute(canonicalListingPath(locale, slug, page)),
      languages: Object.fromEntries(Object.entries(languageAlternates(category)).map(([code, path]) => [code, absolute(path)])),
    },
    ...(category.image ? { openGraph: { title, images: [{ url: category.image }] } } : {}),
  };
}
