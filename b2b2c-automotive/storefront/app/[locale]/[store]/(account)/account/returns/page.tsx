// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageTitle } from '@/components/account/Panel';
import { ReturnList } from '@/components/account/ReturnList';
import { isAppLocale } from '@/i18n/config';
import { listReturns } from '@/lib/ct/account-orders';
import { getShellContext } from '@/lib/ct/shell';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; store: string }> };

/** Returns (workstream Q-07): the returns of this customer's orders with the status the reseller has set in the portal. */
export default async function ReturnsPage({ params }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await getSession();
  if (!session.customerId) notFound();
  const [returns, ctx, t] = await Promise.all([listReturns(store, session.customerId, locale), getShellContext(store, locale), getTranslations({ locale, namespace: 'account.returns' })]);
  return (
    <div className="grid gap-5">
      <PageTitle>{t('title')}</PageTitle>
      <ReturnList store={store} returns={returns} timeZone={ctx?.settings.timezone} />
    </div>
  );
}
