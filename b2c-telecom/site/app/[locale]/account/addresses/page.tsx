import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddressBook } from '@/components/account/AddressBook';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { requireCustomerPage } from '@/lib/auth/guard';
import { isLocale, marketFromLocale } from '@/lib/config/markets';
import { mapAddresses } from '@/lib/mappers/address';
import type { SavedAddress } from '@/lib/types';

// Session-specific: read on every request, never cached, never indexed.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.addresses' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AddressesPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  // The customer is read fresh by the guard; the address book is mapped from that same read (no second request).
  const { customer } = await requireCustomerPage(locale, '/account/addresses');
  const t = await getTranslations({ locale, namespace: 'account' });
  const addresses: SavedAddress[] = mapAddresses(customer);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title'), href: '/account' }, { label: t('addresses.title') }]} />
        <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{t('addresses.title')}</h1>
      </header>
      <AddressBook initial={addresses} country={marketFromLocale(locale).country} />
    </div>
  );
}
