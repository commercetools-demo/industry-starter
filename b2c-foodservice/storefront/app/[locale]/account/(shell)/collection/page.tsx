import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import CollectionTab from '@/components/account/CollectionTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';
import { loadCollectionFigures } from '@/lib/account/collection-data';
import { accountMetadata } from '@/lib/auth/account-metadata';

export const dynamic = 'force-dynamic';
export const generateMetadata = accountMetadata('collection');

/** Collection tab. US market only (D-035): in Canada the page does not exist (404) and the tab is not listed. */
export default async function AccountCollectionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/collection');
  const { collection, freeShippingThreshold } = await loadCollectionFigures();
  if (!collection) notFound();
  return <CollectionTab freeShippingThreshold={freeShippingThreshold} />;
}
