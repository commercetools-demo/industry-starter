// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InvoicePrint } from '@/components/account/InvoicePrint';
import { isAppLocale } from '@/i18n/config';
import { loadAccountOrder } from '@/lib/ct/account-order-page';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; store: string; orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'account.invoice' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/** Invoice (workstream Q-06, D8): a printable page, the invoice reference is the order number. Same 404 rule as the order page; never indexed. */
export default async function InvoicePage({ params }: Props) {
  const { locale, store, orderNumber } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await getSession();
  if (!session.customerId) notFound();
  const loaded = await loadAccountOrder(store, locale, session.customerId, orderNumber);
  if (!loaded) notFound();
  const { order, view, ctx } = loaded;
  const branch = view.pickup ? null : ctx.branches[0];
  const seller = { name: ctx.settings.name, address: view.pickup?.address ?? branch?.address ?? null };
  const address = order.shippingAddress ?? order.billingAddress;
  const name = [address?.firstName, address?.lastName].filter(Boolean).join(' ') || null;
  return <InvoicePrint view={view} store={store} createdAt={order.createdAt} seller={seller} buyer={{ name, email: view.email }} />;
}
