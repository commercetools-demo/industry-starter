// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { OrderDetail } from '@/components/account/OrderDetail';
import { PageTitle } from '@/components/account/Panel';
import { isAppLocale } from '@/i18n/config';
import { loadAccountOrder } from '@/lib/ct/account-order-page';
import { getSession } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { accountPageTitle } from '@/lib/account/page-title';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; store: string; orderNumber: string }> };

export const generateMetadata = accountPageTitle('order', ({ orderNumber }) => ({ number: orderNumber }));

/** Order detail (workstream Q-06). Another customer's order, an unknown number and an order of another store are the same 404. */
export default async function OrderPage({ params }: Props) {
  const { locale, store, orderNumber } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await getSession();
  if (!session.customerId) notFound();
  const loaded = await loadAccountOrder(store, locale, session.customerId, orderNumber);
  if (!loaded) notFound();
  const t = await getTranslations({ locale, namespace: 'account.order' });
  return (
    <div className="grid gap-5">
      <PageTitle>{t('title', { number: loaded.view.number })}</PageTitle>
      <OrderDetail view={loaded.view} store={store} createdAt={loaded.order.createdAt} eligibility={loaded.eligibility} returns={loaded.returns} />
    </div>
  );
}
