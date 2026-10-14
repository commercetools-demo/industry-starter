// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Store performance (S-04, decisions 6 and 7): sales, orders, average order and top five products of the last 30 days, plus a
// daily series for the chart. Admin only (the route checks `store.view-performance` first). No conversion: there is no analytics source.
import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { adminRoot } from '@/lib/ct/admin-client';
import { createTtlCache } from '@/lib/ttl-cache';
import { aggregate } from './aggregate';
import { EXCLUDE_TEST_ORDERS } from './names';
import { withTimeout } from './timeout';
import type { StorePerformance } from '@/lib/dashboard/types';

const PAGE = 500;
const MAX_PAGES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const cache = createTtlCache<StorePerformance>({ ttlMs: 60_000, negativeTtlMs: 1000 });
export const clearStorePerformanceCache = (): void => cache.clear();

async function load(storeKey: string, days: number, now: Date): Promise<StorePerformance> {
  const from = new Date(now.getTime() - days * DAY_MS).toISOString();
  const orders: Order[] = [];
  let total: number | undefined;
  let lastPageFull = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { body } = await adminRoot
      .inStoreKeyWithStoreKeyValue({ storeKey })
      .orders()
      .get({
        queryArgs: {
          where: `createdAt >= :from and orderState != "Cancelled" and ${EXCLUDE_TEST_ORDERS}`,
          'var.from': from,
          sort: 'createdAt desc',
          limit: PAGE,
          offset: page * PAGE,
          withTotal: page === 0,
        },
      })
      .execute();
    if (page === 0) total = body.total;
    orders.push(...body.results);
    lastPageFull = body.results.length === PAGE;
    if (body.results.length < PAGE) break;
  }
  const truncated = total !== undefined ? total > orders.length : lastPageFull;
  return aggregate(orders, now, days, truncated);
}

/** Cached 60 s per store key (aggregate numbers of one store, never per-user data). */
export function loadStorePerformance(storeKey: string, days = 30, now: Date = new Date()): Promise<StorePerformance> {
  const hit = cache.get(storeKey);
  if (hit) return Promise.resolve(hit);
  return withTimeout(load(storeKey, days, now), 20_000).then((value) => {
    cache.set(storeKey, value);
    return value;
  });
}
