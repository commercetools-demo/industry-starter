// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderList } from '@/components/account/OrderList';
import { PageTitle } from '@/components/account/Panel';
import { isAppLocale } from '@/i18n/config';
import { listOrders } from '@/lib/ct/account-orders';
import { getShellContext } from '@/lib/ct/shell';
import { getSession } from '@/lib/session';
import { accountPageTitle } from '@/lib/account/page-title';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; store: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = accountPageTitle('orders');

/** Orders (workstream Q-06): this customer's orders in this store, newest first, ten a page. */
export default async function OrdersPage({ params, searchParams }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await getSession();
  if (!session.customerId) notFound();
  const raw = (await searchParams).page;
  const page = Math.max(1, Math.min(1000, Number.parseInt(typeof raw === 'string' ? raw : '1', 10) || 1));
  const [list, ctx, t] = await Promise.all([listOrders(store, session.customerId, { page }), getShellContext(store, locale), getTranslations({ locale, namespace: 'account.orders' })]);
  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      <OrderList store={store} list={list} timeZone={ctx?.settings.timezone} />
    </div>
  );
}
