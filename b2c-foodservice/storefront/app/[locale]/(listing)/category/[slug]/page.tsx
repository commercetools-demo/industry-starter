import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import ListingRoute from '@/components/listing/ListingRoute';
import { renderPage } from '@/components/page-builder/renderPage';
import { provideListing } from '@/lib/listing/request-listing';
import { getListing, listingMetadata } from '@/lib/listing/page-data';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return listingMetadata(locale, await getListing(locale, 'category', decodeURIComponent(slug), await searchParams));
}

/**
 * `/category/<slug>`: the category subtree. An unknown slug (or an empty subtree without filters) is a 404.
 *
 * The native listing is always loaded, in parallel with the page builder's layout: it decides not-found and the redirect past
 * the last page, and it is the data every authored listing component shows (shared through `provideListing`, so it loads once).
 * A published category page, or the global category fallback page, replaces the native layout; with no page, or when the page
 * builder fails, the native listing renders as before.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const listing = getListing(locale, 'category', decodeURIComponent(slug), sp);
  provideListing(listing);
  const [result, outcome] = await Promise.all([listing, renderPage({ locale, segments: ['category', slug], searchParams: sp })]);
  if (outcome.kind === 'page' && result.kind === 'ok') return <div>{outcome.node}</div>;
  return <ListingRoute locale={locale} result={result} />;
}
