// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AccountShell } from '@/components/account/AccountShell';
import { isAppLocale } from '@/i18n/config';
import { requireSignedIn } from '@/lib/account/guard';
import { subscriptionsOffered } from '@/lib/ct/account-subscriptions';
import { subscriptionsPurchaseEnabled } from '@/lib/subscriptions/config';

type Props = { children: ReactNode; params: Promise<{ locale: string; store: string }> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * The account area (workstream Q). Protected on the server (D2): without a signed-in customer the request goes to sign-in with the page it
 * wanted as `next`. The Subscriptions menu item shows when subscriptions are purchasable or the customer has recurring orders (D10).
 */
export default async function AccountLayout({ children, params }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireSignedIn(locale, store);
  const showSubscriptions = subscriptionsPurchaseEnabled() || (await subscriptionsOffered(store, session.customerId).catch(() => false));
  return (
    <AccountShell store={store} showSubscriptions={showSubscriptions}>
      {children}
    </AccountShell>
  );
}
