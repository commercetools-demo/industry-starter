import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DashboardExtras } from '@/components/account/DashboardExtras';
import { PanelSkeleton } from '@/components/account/PanelSkeleton';
import { SummaryCard, SummaryCards } from '@/components/account/SummaryCards';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { requireCustomerPage } from '@/lib/auth/guard';
import { isLocale } from '@/lib/config/markets';
import { mapAddress } from '@/lib/mappers/order';
import type { AddressView } from '@/lib/types';
import { BillPanel } from './_panels/BillPanel';
import { ContractPanel } from './_panels/ContractPanel';
import { PlansPanel } from './_panels/PlansPanel';
import { RecentOrdersPanel } from './_panels/RecentOrdersPanel';

// Session-specific: read on every request, never cached, never indexed.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const H2 = 'm-0 font-display text-2xl font-bold tracking-ui';

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  // Before anything about the account is read: anonymous or invalidated sessions go to /login?returnTo=/<locale>/account.
  const { customer } = await requireCustomerPage(locale, '/account');
  const t = await getTranslations({ locale, namespace: 'account' });

  const defaultAddress = customer.addresses.find((address) => address.id === customer.defaultShippingAddressId) ?? customer.addresses[0];
  const address: AddressView | null = defaultAddress ? mapAddress(defaultAddress, customer.defaultShippingAddressId) : null;
  const accountField: unknown = (customer.custom?.fields as Record<string, unknown> | undefined)?.accountNumber;
  const customerNumber = customer.customerNumber ?? (typeof accountField === 'string' && accountField !== '' ? accountField : null);
  const panel = { customerId: customer.id, locale };

  return (
    <div className="flex flex-col gap-9">
      <header className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title') }]} />
        <h1 className="m-0 font-display text-4xl font-bold tracking-ui">{t('hi', { firstName: customer.firstName?.trim() ?? '' })}</h1>
      </header>

      <SummaryCards
        email={customer.email}
        customerNumber={customerNumber}
        address={address}
        bill={
          <Suspense
            fallback={
              <SummaryCard label={t('card.bill')}>
                <PanelSkeleton lines={2} />
              </SummaryCard>
            }
          >
            <BillPanel {...panel} />
          </Suspense>
        }
      />

      <section aria-labelledby="recent-orders" className="flex flex-col gap-5">
        <h2 id="recent-orders" className={H2}>
          {t('recent.title')}
        </h2>
        <Suspense fallback={<PanelSkeleton />}>
          <RecentOrdersPanel {...panel} />
        </Suspense>
      </section>

      <section aria-labelledby="current-contract" className="flex flex-col gap-5">
        <h2 id="current-contract" className={H2}>
          {t('contract.title')}
        </h2>
        <Suspense fallback={<PanelSkeleton lines={4} />}>
          <ContractPanel {...panel} />
        </Suspense>
      </section>

      <section aria-labelledby="your-plans" className="flex flex-col gap-5">
        <h2 id="your-plans" className={H2}>
          {t('plans.title')}
        </h2>
        <Suspense fallback={<PanelSkeleton lines={4} />}>
          <PlansPanel {...panel} />
        </Suspense>
      </section>

      <DashboardExtras />
    </div>
  );
}
