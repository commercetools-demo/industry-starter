import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import ListingRoute from '@/components/listing/ListingRoute';
import { getListing, listingMetadata } from '@/lib/listing/page-data';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  return listingMetadata(locale, await getListing(locale, 'search', undefined, await searchParams));
}

/** `/search?q=`: results. An empty query shows the prompt and makes no search call. */
export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ListingRoute locale={locale} result={await getListing(locale, 'search', undefined, await searchParams)} />;
}
