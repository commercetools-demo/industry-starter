// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pages through a store's recent orders for the Channels tab (workstream U-05). Store scoped read with the admin client; at most
// `maxPages` pages of `pageSize` orders so one screen can never run away (the caller reports `truncated`).
import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { adminRoot } from '@/lib/ct/admin-client';

export const ORDER_PAGE_SIZE = 500;
export const ORDER_MAX_PAGES = 5;

/** Orders of the store created since `from`, not cancelled, in pages. The last page is shorter than `pageSize`. */
export async function* pageOrders(storeKey: string, from: Date, pageSize = ORDER_PAGE_SIZE, maxPages = ORDER_MAX_PAGES): AsyncGenerator<Order[]> {
  for (let page = 0; page < maxPages; page += 1) {
    const { body } = await adminRoot
      .inStoreKeyWithStoreKeyValue({ storeKey })
      .orders()
      .get({ queryArgs: { where: 'createdAt >= :from and orderState != "Cancelled"', 'var.from': from.toISOString(), sort: 'createdAt desc', limit: pageSize, offset: page * pageSize, withTotal: false } })
      .execute();
    if (body.results.length > 0) yield body.results;
    if (body.results.length < pageSize) return;
  }
}
