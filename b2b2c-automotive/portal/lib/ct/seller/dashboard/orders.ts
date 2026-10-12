// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Orders of the signed-in store for the dashboard (S-02). Admin client, in-store endpoint only, after the route authorized the store.
import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { adminRoot } from '@/lib/ct/admin-client';
import { mapMoney } from '@/lib/mappers/money';
import { mapOrderStatus } from '@/lib/mappers/order-status';
import { EXCLUDE_TEST_ORDERS, shortName } from './names';
import { withTimeout } from './timeout';
import type { DashboardOrder } from '@/lib/dashboard/types';

const orders = (storeKey: string) => adminRoot.inStoreKeyWithStoreKeyValue({ storeKey }).orders();

export function toDashboardOrder(o: Order): DashboardOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber ?? o.id,
    createdAt: o.createdAt,
    customer: shortName(o.shippingAddress ?? o.billingAddress),
    total: mapMoney(o.totalPrice),
    chip: mapOrderStatus(o),
  };
}

/** Newest storefront orders of the store, test orders left out. */
export function listRecentOrders(storeKey: string, limit = 5): Promise<DashboardOrder[]> {
  return withTimeout(
    orders(storeKey)
      .get({ queryArgs: { where: EXCLUDE_TEST_ORDERS, sort: 'createdAt desc', limit, withTotal: false } })
      .execute()
      .then(({ body }) => body.results.map(toDashboardOrder)),
  );
}

/** Orders in state Open: one request with `limit 1`, the count is `total`. */
export function countOpenOrders(storeKey: string): Promise<number> {
  return withTimeout(
    orders(storeKey)
      .get({ queryArgs: { where: `orderState="Open" and ${EXCLUDE_TEST_ORDERS}`, limit: 1, withTotal: true } })
      .execute()
      .then(({ body }) => body.total ?? 0),
  );
}
