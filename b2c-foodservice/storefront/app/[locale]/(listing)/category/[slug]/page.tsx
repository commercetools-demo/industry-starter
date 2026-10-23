import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import ListingRoute from '@/components/listing/ListingRoute';
import { getListing, listingMetadata } from '@/lib/listing/page-data';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return listingMetadata(locale, await getListing(locale, 'category', decodeURIComponent(slug), await searchParams));
}

/** `/category/<slug>`: the category subtree. An unknown slug (or an empty subtree without filters) is a 404. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <ListingRoute locale={locale} result={await getListing(locale, 'category', decodeURIComponent(slug), await searchParams)} />;
}
