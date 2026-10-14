import 'server-only';
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure aggregation of store orders into the performance block (no commercetools client, so the fixtures can use it).
import type { Order } from '@commercetools/platform-sdk';
import type { LocalizedString, Money } from '@/lib/types';
import { isTestOrder } from './names';
import type { StorePerformance } from '@/lib/dashboard/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const money = (centAmount: number, currencyCode: string, fractionDigits: number): Money => ({ centAmount, currencyCode, fractionDigits });

/** The currency most orders are in (a store sells in one currency; a stray order in another is left out of the sums). */
function dominantCurrency(orders: Order[]): { code: string; digits: number } {
  const counts = new Map<string, { n: number; digits: number }>();
  for (const o of orders) {
    const c = counts.get(o.totalPrice.currencyCode) ?? { n: 0, digits: o.totalPrice.fractionDigits };
    counts.set(o.totalPrice.currencyCode, { n: c.n + 1, digits: c.digits });
  }
  const [code, info] = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0] ?? ['EUR', { n: 0, digits: 2 }];
  return { code, digits: info.digits };
}

export function aggregate(orders: Order[], now: Date, days: number, truncated: boolean): StorePerformance {
  const counted = orders.filter((o) => o.orderState !== 'Cancelled' && !isTestOrder(o));
  const { code, digits } = dominantCurrency(counted);
  const mine = counted.filter((o) => o.totalPrice.currencyCode === code);
  const total = mine.reduce((sum, o) => sum + o.totalPrice.centAmount, 0);

  const bySku = new Map<string, { name: LocalizedString; units: number; revenue: number }>();
  for (const o of mine) {
    for (const line of o.lineItems) {
      const sku = line.variant.sku;
      if (!sku) continue;
      const entry = bySku.get(sku) ?? { name: line.name, units: 0, revenue: 0 };
      entry.units += line.quantity;
      entry.revenue += line.totalPrice.centAmount;
      bySku.set(sku, entry);
    }
  }
  const topProducts = [...bySku.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([sku, e]) => ({ sku, name: e.name, units: e.units, revenue: money(e.revenue, code, digits) }));

  const today = Math.floor(now.getTime() / DAY_MS);
  const daily = Array.from({ length: days }, (_, i) => ({ date: new Date((today - (days - 1 - i)) * DAY_MS).toISOString().slice(0, 10), sales: 0 }));
  const index = new Map(daily.map((d, i) => [d.date, i]));
  for (const o of mine) {
    const i = index.get(o.createdAt.slice(0, 10));
    if (i !== undefined) daily[i].sales += o.totalPrice.centAmount;
  }

  return {
    currency: code,
    periodDays: 30,
    sales: money(total, code, digits),
    orders: mine.length,
    averageOrder: mine.length ? money(Math.round(total / mine.length), code, digits) : null,
    topProducts,
    daily,
    truncated,
  };
}
