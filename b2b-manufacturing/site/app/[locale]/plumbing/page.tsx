import { setRequestLocale } from 'next-intl/server';
import { ListingPage, listingMetadata } from '@/components/service/ListingPage';
import { getServicesByCategory } from '@/lib/ct/services';

/** Public and identical for every visitor: static with ISR, never reads the session. */
export const revalidate = 60;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return listingMetadata('plumbing', locale);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const services = await getServicesByCategory('plumbing', locale);
  return <ListingPage category="plumbing" locale={locale} services={services} />;
}
