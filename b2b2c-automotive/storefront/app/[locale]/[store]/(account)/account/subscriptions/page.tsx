// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { SubscriptionList } from '@/components/account/SubscriptionList';
import { isAppLocale } from '@/i18n/config';
import { getShellContext } from '@/lib/ct/shell';

type Props = { params: Promise<{ locale: string; store: string }> };

/** Subscriptions (workstream Q-12): skip, pause, resume, change frequency, cancel. */
export default async function SubscriptionsPage({ params }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const ctx = await getShellContext(store, locale);
  return <SubscriptionList store={store} timeZone={ctx?.settings.timezone} />;
}
