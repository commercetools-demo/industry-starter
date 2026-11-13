import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { brandOf } from '@/lib/brands';
import ListingRoute from '@/components/listing/ListingRoute';
import { getListing, listingMetadata } from '@/lib/listing/page-data';

type Props = { params: Promise<{ brand?: string; locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { brand, locale } = await params;
  return listingMetadata(locale, brand, await getListing(locale, brand, 'search', undefined, await searchParams));
}

/** `/search?q=`: results. An empty query shows the prompt and makes no search call. */
export default async function SearchPage({ params, searchParams }: Props) {
  const { brand, locale } = await params;
  setRequestLocale(locale);
  return <ListingRoute locale={locale} brand={brandOf(brand).slug} result={await getListing(locale, brand, 'search', undefined, await searchParams)} />;
}
