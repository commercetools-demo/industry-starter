// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { OverviewPanel } from '@/components/account/OverviewPanel';
import type { PickupReady } from '@/components/account/PickupReadyNotice';
import { isAppLocale } from '@/i18n/config';
import { getProfile } from '@/lib/ct/account-customer';
import { listRecentOrders } from '@/lib/ct/account-orders';
import { PICKUP_BRANCH_FIELD } from '@/lib/ct/delivery';
import { getShellContext } from '@/lib/ct/shell';
import { mapOrderStatus } from '@/lib/mappers/order';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; store: string }> };

/** Account home (workstream Q-05): greeting, active vehicle, latest order status, quick links and the pickup-ready notice(s). */
export default async function AccountOverviewPage({ params }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await getSession();
  if (!session.customerId) notFound(); // the layout redirects first; this only narrows the type
  const [ctx, profile, orders] = await Promise.all([getShellContext(store, locale), getProfile(store, session.customerId), listRecentOrders(store, session.customerId, 10)]);
  if (!ctx) notFound();

  const ready: PickupReady[] = orders
    .filter((order) => mapOrderStatus(order) === 'ready-for-pickup')
    .map((order) => {
      const branch = ctx.branches.find((b) => b.key === (order.custom?.fields?.[PICKUP_BRANCH_FIELD] as string | undefined));
      return { orderNumber: order.orderNumber ?? '', storeName: branch?.name ?? ctx.settings.name, address: branch?.address ?? null, hours: branch?.hours ?? null };
    });
  const latest = orders[0] ? { number: orders[0].orderNumber ?? '', createdAt: orders[0].createdAt, status: mapOrderStatus(orders[0]) } : null;

  return <OverviewPanel store={store} firstName={profile.firstName} latest={latest} ready={ready} timeZone={ctx.settings.timezone} />;
}
