import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddressBook } from '@/components/account/AddressBook';
import { DetailsCard } from '@/components/account/DetailsCard';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.addresses' });
  return { title: t('metaTitle') };
}

/** Guarded by the `(protected)` layout. Server page, client island: the list lives in SWR (`/api/account/addresses`). The Details card is the rail with Addresses marked active. */
export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'account.addresses' });
  return (
    <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">
      <h1 className="mb-(--space-6) text-[52px]">{t('title')}</h1>
      <div className="grid items-start gap-[42px] desktop:grid-cols-[1.6fr_1fr]">
        <div className="order-2 desktop:order-1">
          <AddressBook />
        </div>
        <aside className="order-1 desktop:order-2">
          <DetailsCard current="addresses" />
        </aside>
      </div>
    </div>
  );
}
