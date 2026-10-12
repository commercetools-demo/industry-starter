// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Shapes of the dashboard (workstream S). Type only, no server imports: client components import these.
import type { OrderChip } from '@/lib/mappers/order-status';
import type { LocalizedString, Money } from '@/lib/types';

export interface DashboardOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  /** First name and initial only ("Anna T."), never the full name. Empty when the order has no address. */
  customer: string;
  total: Money;
  chip: OrderChip;
}

export type ReturnStatus = 'requested' | 'in-transit' | 'received' | 'inspected' | 'refunded' | 'rejected';

export interface ReturnRow {
  /** `<order id>:<return item id>` */
  id: string;
  returnNumber: string;
  orderNumber: string;
  customer: string;
  items: { quantity: number; name: LocalizedString }[];
  status: ReturnStatus;
}

export interface RenewalRow {
  id: string;
  nextOrderAt: string;
  /** Name of the first subscribed part and how many parts the subscription has. */
  name: LocalizedString;
  itemCount: number;
}

export interface BranchStock {
  branch: { key: string; name: LocalizedString };
  parts: { sku: string; name: LocalizedString; available: number }[];
}

export interface HeadsUp {
  kind: 'out-of-stock-everywhere';
  count: number;
  /** Starts with `/`; rendered with the locale-aware Link. */
  href: string;
}

/** The orders widget and the Open orders KPI share one endpoint, hence one key and one Retry. */
export interface RecentOrdersResponse {
  orders: DashboardOrder[];
  openCount: number;
}

/** The three other KPIs; each may be `null` when only that source failed. */
export interface DashboardKpis {
  openReturns: number | null;
  activeSubscriptions: number | null;
  unansweredReviews: number | null;
}

export interface DailySales {
  /** `YYYY-MM-DD` in UTC. */
  date: string;
  sales: number;
}

export interface StorePerformance {
  currency: string;
  periodDays: 30;
  sales: Money;
  orders: number;
  averageOrder: Money | null;
  topProducts: { sku: string; name: LocalizedString; units: number; revenue: Money }[];
  /** One entry per day of the period, oldest first, in minor units of `currency`. */
  daily: DailySales[];
  truncated: boolean;
}

export interface StoreHeader {
  name: LocalizedString;
  /** Country of the store (store-settings `defaultCountry`). */
  region: string;
  currency: string;
}
