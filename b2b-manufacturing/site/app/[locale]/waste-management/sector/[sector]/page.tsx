import { setRequestLocale } from 'next-intl/server';
import { ListingPage, listingMetadata } from '@/components/service/ListingPage';
import { SECTOR_KEYS } from '@/components/service/constants';
import { routing } from '@/i18n/routing';
import { getServicesByCategory } from '@/lib/ct/services';

/** `/waste-management?sector=x` is rewritten here (next.config rewrites) so every sector is a cacheable static page. */
export const revalidate = 60;

type Props = { params: Promise<{ locale: string; sector: string }> };

export const generateStaticParams = () => routing.locales.flatMap((locale) => SECTOR_KEYS.map((sector) => ({ locale, sector })));

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return listingMetadata('waste-management', locale);
}

export default async function Page({ params }: Props) {
  const { locale, sector } = await params;
  setRequestLocale(locale);
  const services = await getServicesByCategory('waste-management', locale);
  return <ListingPage category="waste-management" locale={locale} sector={sector} services={services} />;
}
