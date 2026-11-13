import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { brandOf } from '@/lib/brands';
import ListingRoute from '@/components/listing/ListingRoute';
import { getListing, listingMetadata } from '@/lib/listing/page-data';

type Props = { params: Promise<{ brand?: string; locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { brand, locale } = await params;
  return listingMetadata(locale, brand, await getListing(locale, brand, 'shop', undefined, await searchParams));
}

/** `/shop`: all products. Dynamic (reads the session for market and store). */
export default async function ShopPage({ params, searchParams }: Props) {
  const { brand, locale } = await params;
  setRequestLocale(locale);
  return <ListingRoute locale={locale} brand={brandOf(brand).slug} result={await getListing(locale, brand, 'shop', undefined, await searchParams)} />;
}
