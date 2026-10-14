// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Order resolution after the hosted Checkout (O D4a, D5): the one payment return URL `/checkout/return` has no locale and no store, so the
// order says where the shopper goes. Idempotent (no state is created twice), and every failure is the same `not-found` (no enumeration).
import 'server-only';
import { DEFAULT_LOCALE_KEY, isAppLocale, type AppLocale } from '@/i18n/config';
import { ensureOrderNumber, getOrderById, getOrderByNumber, reconcilePickupBranch } from '@/lib/ct/orders';
import { canViewOrder, signOrderAccessToken } from '@/lib/order-access';
import type { Session } from '@/lib/types';

export type ReturnResolution =
  | { status: 'not-found' }
  | {
      status: 'ok';
      locale: AppLocale;
      storeKey: string;
      orderId: string;
      orderNumber: string;
      /** The cart the order came from; the route clears it from the session when it is the session's cart. */
      cartId: string | undefined;
      /** Confirmation path (P) with `?t=` for a shopper who is not the signed-in owner. */
      path: string;
    };

export interface ReturnParams {
  orderId?: string;
  orderNumber?: string;
}

/**
 * Loads the order by `orderId` (or `orderNumber`), checks that this browser or customer may see it, makes sure it has a number,
 * reconciles the pickup branch, and returns the confirmation path. A second call returns the same path.
 */
export async function resolveReturn(params: ReturnParams, session: Pick<Session, 'customerId' | 'anonymousId' | 'branchKey' | 'locale'>): Promise<ReturnResolution> {
  const order = params.orderId ? await getOrderById(params.orderId) : params.orderNumber ? await getOrderByNumber(params.orderNumber) : null;
  const storeKey = order?.store?.key;
  if (!order || !storeKey) return { status: 'not-found' };
  const viewer = { id: order.id, storeKey, ...(order.customerId ? { customerId: order.customerId } : {}), ...(order.anonymousId ? { anonymousId: order.anonymousId } : {}) };
  if (!(await canViewOrder(session, viewer))) return { status: 'not-found' };

  const orderNumber = await ensureOrderNumber(order);
  await reconcilePickupBranch(order, session.branchKey);

  const locale = isAppLocale(order.locale) ? order.locale : (session.locale ?? DEFAULT_LOCALE_KEY);
  const owner = Boolean(order.customerId) && session.customerId === order.customerId;
  const token = owner ? undefined : await signOrderAccessToken({ orderId: order.id, storeKey });
  const base = `/${locale}/${storeKey}/checkout/confirmation/${orderNumber}`;
  return { status: 'ok', locale, storeKey, orderId: order.id, orderNumber, cartId: order.cart?.id, path: token ? `${base}?t=${token}` : base };
}
