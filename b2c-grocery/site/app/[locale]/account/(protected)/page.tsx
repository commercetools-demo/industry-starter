import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountShell } from '@/components/account/AccountShell';
import { AddressCard } from '@/components/account/AddressCard';
import { DetailsCard } from '@/components/account/DetailsCard';
import { OrdersList } from '@/components/account/OrdersList';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav' });
  return { title: t('account') };
}

const DASHBOARD_ORDERS = 5;

/** Dashboard. Per-customer data is client-fetched through `/api/account/*` (private, no-store); the layout guards the page. */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'account.orders' });
  return (
    <AccountShell
      main={
        <section aria-labelledby="account-orders-title">
          <h3 id="account-orders-title" className="mb-(--space-3) text-[24px]">
            {t('title')}
          </h3>
          <OrdersList preview={DASHBOARD_ORDERS} />
        </section>
      }
      aside={
        <>
          <AddressCard />
          <DetailsCard />
        </>
      }
    />
  );
}
