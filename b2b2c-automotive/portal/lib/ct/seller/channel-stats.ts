// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The Channels tab (workstream U-05, decisions 9 and 10): the store's orders of the last 30 days grouped by the order custom field
// `salesChannel` (seed type `malva-checkout`). Orders with `isTest = true` are excluded; orders without the field count as web
// and mark that row "indicative". `tiktok` is a Demo channel with deterministic synthetic figures that are never part of the real
// shares. `in-store` is Live (orders placed at a branch or on a customer's behalf) and has no share link.
import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { fixtureOrders } from '@/lib/portal/u-fixtures';
import { parseSalesChannel, type SalesChannel } from '@/lib/portal/share-links';
import type { ChannelRow, ChannelStats } from '@/lib/store/types';
import type { Money } from '@/lib/types';
import { pageOrders } from './order-pager';

export const CHANNEL_ROWS: readonly { id: SalesChannel; label: string; status: 'Live' | 'Demo' }[] = [
  { id: 'web', label: 'Web', status: 'Live' },
  { id: 'instagram', label: 'Instagram', status: 'Live' },
  { id: 'facebook', label: 'Facebook', status: 'Live' },
  { id: 'whatsapp', label: 'WhatsApp', status: 'Live' },
  { id: 'in-store', label: 'In store', status: 'Live' },
  { id: 'tiktok', label: 'TikTok', status: 'Demo' },
];

export type { ChannelRow, ChannelStats };

/** A small deterministic hash (FNV-1a) for the Demo channel: the same store always shows the same numbers. */
export function seededNumber(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const money = (centAmount: number, currencyCode: string): Money => ({ centAmount, currencyCode, fractionDigits: 2 });

/** Percentages that add up to exactly 100 (largest remainder), or all zeros when there is no revenue. */
export function shares(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rest: r - floors[i] })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

export interface OrderFacts {
  channel: SalesChannel | null;
  isTest: boolean;
  cents: number;
  currency: string;
}

export function factsOf(order: Pick<Order, 'custom' | 'totalPrice'>): OrderFacts {
  const f = (order.custom?.fields ?? {}) as Record<string, unknown>;
  return { channel: parseSalesChannel(f.salesChannel), isTest: f.isTest === true, cents: order.totalPrice.centAmount, currency: order.totalPrice.currencyCode };
}

/** Pure aggregation, separate from the paging so it is testable with plain facts. */
export function aggregate(storeKey: string, facts: readonly OrderFacts[], truncated: boolean, days: number, fallbackCurrency = 'EUR'): ChannelStats {
  const real = facts.filter((o) => !o.isTest);
  // One currency per store; an order in another currency is counted but not added to the revenue.
  const currency = real[0]?.currency ?? fallbackCurrency;
  const sums = new Map<SalesChannel, { orders: number; cents: number }>(CHANNEL_ROWS.map((r) => [r.id, { orders: 0, cents: 0 }]));
  let defaultedToWeb = 0;
  for (const o of real) {
    const id = o.channel ?? 'web';
    if (o.channel === null) defaultedToWeb += 1;
    // A real order tagged tiktok is kept apart: the TikTok row stays synthetic and out of the real shares.
    const sum = sums.get(id) as { orders: number; cents: number };
    sum.orders += 1;
    if (o.currency === currency) sum.cents += o.cents;
  }
  const live = CHANNEL_ROWS.filter((r) => r.status === 'Live');
  const liveShares = shares(live.map((r) => sums.get(r.id)?.cents ?? 0));
  return {
    currency,
    days,
    truncated,
    rows: CHANNEL_ROWS.map((r) => {
      if (r.status === 'Demo') {
        const n = seededNumber(`${storeKey}${r.id}`);
        const orders = 3 + (n % 18);
        return { id: r.id, label: r.label, status: r.status, orders, revenue: money(orders * (4500 + ((n >>> 8) % 6000)), currency), sharePercent: 0, indicative: true };
      }
      const sum = sums.get(r.id) as { orders: number; cents: number };
      return { id: r.id, label: r.label, status: r.status, orders: sum.orders, revenue: money(sum.cents, currency), sharePercent: liveShares[live.findIndex((l) => l.id === r.id)], indicative: r.id === 'web' && defaultedToWeb > 0 };
    }),
  };
}

export async function loadChannelStats(storeKey: string, days = 30, now: Date = new Date()): Promise<ChannelStats> {
  if (devFixturesEnabled()) return aggregate(storeKey, fixtureOrders.facts(storeKey), false, days);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const facts: OrderFacts[] = [];
  let pages = 0;
  let lastFull = false;
  for await (const page of pageOrders(storeKey, from)) {
    pages += 1;
    lastFull = page.length === 500;
    facts.push(...page.map(factsOf));
  }
  return aggregate(storeKey, facts, pages >= 5 && lastFull, days);
}
