// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderConfirmation } from '@/components/order/OrderConfirmation';
import type { Viewer } from '@/components/order/FollowUpActions';
import { isAppLocale } from '@/i18n/config';
import { PICKUP_BRANCH_FIELD } from '@/lib/ct/delivery';
import { getOrderForConfirmation, getRecurringOrderForOrder } from '@/lib/ct/orders';
import { getShellContext } from '@/lib/ct/shell';
import { mapOrderView } from '@/lib/mappers/order';
import { canViewOrder, signOrderAccessToken, verifyOrderAccessToken } from '@/lib/order-access';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; store: string; orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Private page: never indexed, and the private link in the address never leaves as a referrer (the headers say the same, `next.config.ts`). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'order' });
  return { title: t('metaTitle'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/**
 * Order confirmation (workstream P). The order is read in the store of the URL by its number. Only the signed-in owner, the browser that
 * placed it (same anonymous id) or the holder of a valid private link (`?t=`) sees it; every other case, and an unknown number, is the
 * same 404. A guest gets a private link to copy (the token of the visit, or a new one); nothing is emailed.
 */
export default async function Page({ params, searchParams }: Props) {
  const { locale, store, orderNumber } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const query = await searchParams;
  const supplied = typeof query.t === 'string' && query.t ? query.t : undefined;

  const [session, order] = await Promise.all([getSession(), getOrderForConfirmation(store, orderNumber)]);
  if (!order || order.store?.key !== store) notFound();
  const subject = { id: order.id, storeKey: store, ...(order.customerId ? { customerId: order.customerId } : {}), ...(order.anonymousId ? { anonymousId: order.anonymousId } : {}) };
  if (!(await canViewOrder(session, subject, supplied))) notFound();

  const hasSubscription = order.lineItems.some((line) => line.recurrenceInfo);
  const [ctx, recurring, cartT] = await Promise.all([
    getShellContext(store, locale),
    hasSubscription ? getRecurringOrderForOrder(order.id) : Promise.resolve(null),
    getTranslations({ locale, namespace: 'cart' }),
  ]);
  if (!ctx) notFound();

  const branchKey = order.custom?.fields?.[PICKUP_BRANCH_FIELD] as string | undefined;
  const view = mapOrderView(order, {
    locale,
    branch: ctx.branches.find((b) => b.key === branchKey) ?? null,
    recurring,
    storeName: ctx.settings.name,
    shipDays: ctx.settings.shipDays,
    timezone: ctx.settings.timezone,
    savingFallback: cartT('savingFallback'),
  });

  const owner = Boolean(order.customerId) && session.customerId === order.customerId;
  const viewer: Viewer = owner ? 'owner' : order.customerId || session.customerId ? 'holder' : 'guest';
  let token: string | undefined;
  if (viewer === 'guest') token = supplied && (await verifyOrderAccessToken(supplied, { orderId: order.id, storeKey: store })) ? supplied : await signOrderAccessToken({ orderId: order.id, storeKey: store });
  const privatePath = token ? `/${locale}/${store}/checkout/confirmation/${view.number}?t=${token}` : null;

  return <OrderConfirmation view={view} store={store} viewer={viewer} privatePath={privatePath} token={token} />;
}
