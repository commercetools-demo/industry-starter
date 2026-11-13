import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { brandOf } from '@/lib/brands';
import ListingRoute from '@/components/listing/ListingRoute';
import { getListing, listingMetadata } from '@/lib/listing/page-data';

type Props = {
  params: Promise<{ brand?: string; locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { brand, locale, slug } = await params;
  return listingMetadata(locale, brand, await getListing(locale, brand, 'category', decodeURIComponent(slug), await searchParams));
}

/** `/category/<slug>`: the category subtree. An unknown slug (or an empty subtree without filters) is a 404. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { brand, locale, slug } = await params;
  setRequestLocale(locale);
  return <ListingRoute locale={locale} brand={brandOf(brand).slug} result={await getListing(locale, brand, 'category', decodeURIComponent(slug), await searchParams)} />;
}
