// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Development fixtures for the dashboard ports (PORTAL_DEV_FIXTURES=on, never production). Synthetic and neutral on purpose
// (decision 11); stores match `lib/portal/dev-fixtures.ts`. Not a statement about real data.
import 'server-only';
import { mapOrderStatus, type OrderChip } from '@/lib/mappers/order-status';
import type { LocalizedString, Money } from '@/lib/types';
import { aggregate } from './aggregate';
import type { DashboardPorts } from './ports';
import type { BranchStock, DashboardOrder, RenewalRow, ReturnRow, StoreHeader, StorePerformance } from '@/lib/dashboard/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (daysAgo: number, hour = 10) => new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS - daysAgo * DAY_MS + hour * 3600_000).toISOString();
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();
const eur = (centAmount: number): Money => ({ centAmount, currencyCode: 'EUR', fractionDigits: 2 });
const ls = (de: string, en: string): LocalizedString => ({ 'de-DE': de, 'en-US': en });

const PARTS = {
  'FX-BRAKE-001': ls('Bremsscheibe vorn, belüftet', 'Brake disc, front vented'),
  'FX-BRAKE-002': ls('Bremsbelagsatz vorn', 'Brake pad set, front'),
  'FX-FILTER-010': ls('Ölfilter, Anschraubfilter', 'Oil filter, spin-on'),
  'FX-WIPER-020': ls('Scheibenwischer-Satz', 'Wiper blade set'),
  'FX-PLUG-030': ls('Zündkerze', 'Spark plug'),
  'FX-BELT-040': ls('Keilrippenriemen', 'Serpentine belt'),
} as const;
const name = (sku: keyof typeof PARTS) => PARTS[sku];

interface FixtureStore {
  header: StoreHeader;
  orders: Array<{ n: number; daysAgo: number; customer: string; cents: number; states: [string, string, string]; lines: Array<[keyof typeof PARTS, number, number]> }>;
  returns: ReturnRow[];
  renewals: RenewalRow[];
  stock: BranchStock[];
  openReturns: number;
  subscriptions: number;
  reviews: number;
  outOfStock: number;
}

const online: FixtureStore = {
  header: { name: ls('DACH Online', 'DACH Online'), region: 'DE', currency: 'EUR' },
  orders: [
    { n: 1006, daysAgo: 0, customer: 'Anna T.', cents: 18940, states: ['Open', 'Pending', 'Paid'], lines: [['FX-BRAKE-001', 2, 15800], ['FX-WIPER-020', 1, 3140]] },
    { n: 1005, daysAgo: 1, customer: 'Jonas K.', cents: 4290, states: ['Open', 'Pending', 'Pending'], lines: [['FX-FILTER-010', 1, 4290]] },
    { n: 1004, daysAgo: 3, customer: 'Mia R.', cents: 32500, states: ['Open', 'Shipped', 'Paid'], lines: [['FX-BRAKE-002', 2, 17000], ['FX-BELT-040', 1, 15500]] },
    { n: 1003, daysAgo: 6, customer: 'Leon B.', cents: 8800, states: ['Cancelled', 'Pending', 'Failed'], lines: [['FX-PLUG-030', 4, 8800]] },
    { n: 1002, daysAgo: 12, customer: 'Sofia W.', cents: 21400, states: ['Complete', 'Delivered', 'Paid'], lines: [['FX-BRAKE-001', 1, 7900], ['FX-FILTER-010', 3, 13500]] },
    { n: 1001, daysAgo: 25, customer: 'Noah F.', cents: 15600, states: ['Complete', 'Delivered', 'Paid'], lines: [['FX-BRAKE-002', 2, 15600]] },
  ],
  returns: [
    { id: 'o1002:r1', returnNumber: 'RET-2001', orderNumber: 'ORD-1002', customer: 'Sofia W.', items: [{ quantity: 1, name: name('FX-BRAKE-001') }], status: 'requested' },
    { id: 'o1001:r2', returnNumber: 'RET-2002', orderNumber: 'ORD-1001', customer: 'Noah F.', items: [{ quantity: 2, name: name('FX-BRAKE-002') }], status: 'received' },
  ],
  renewals: [
    { id: 'ro1', nextOrderAt: inDays(2), name: name('FX-FILTER-010'), itemCount: 1 },
    { id: 'ro2', nextOrderAt: inDays(5), name: name('FX-WIPER-020'), itemCount: 2 },
  ],
  stock: [
    { branch: { key: 'fx-br-hamburg', name: ls('Test Garage Nord Hamburg', 'Test Garage Nord Hamburg') }, parts: [{ sku: 'FX-FILTER-010', name: name('FX-FILTER-010'), available: 0 }, { sku: 'FX-BRAKE-002', name: name('FX-BRAKE-002'), available: 2 }, { sku: 'FX-PLUG-030', name: name('FX-PLUG-030'), available: 4 }] },
    { branch: { key: 'fx-br-berlin', name: ls('Test Garage Nord Berlin', 'Test Garage Nord Berlin') }, parts: [{ sku: 'FX-FILTER-010', name: name('FX-FILTER-010'), available: 1 }] },
  ],
  openReturns: 2,
  subscriptions: 4,
  reviews: 3,
  outOfStock: 2,
};

const direct: FixtureStore = {
  header: { name: ls('Workshop Direct', 'Workshop Direct'), region: 'DE', currency: 'EUR' },
  orders: [{ n: 2001, daysAgo: 2, customer: 'Ida P.', cents: 6200, states: ['Open', 'Pending', 'Paid'], lines: [['FX-PLUG-030', 4, 6200]] }],
  returns: [],
  renewals: [],
  stock: [],
  openReturns: 0,
  subscriptions: 0,
  reviews: 0,
  outOfStock: 0,
};

const south: FixtureStore = {
  ...direct,
  header: { name: ls('Süd Online', 'Süd Online'), region: 'DE', currency: 'EUR' },
  orders: [
    { n: 3002, daysAgo: 0, customer: 'Paul S.', cents: 11100, states: ['Open', 'Pending', 'Paid'], lines: [['FX-BELT-040', 1, 11100]] },
    { n: 3001, daysAgo: 4, customer: 'Eva H.', cents: 7400, states: ['Complete', 'Shipped', 'Paid'], lines: [['FX-WIPER-020', 2, 7400]] },
  ],
  subscriptions: 1,
  reviews: 1,
};

const STORES: Record<string, FixtureStore> = { 'fx-store-online': online, 'fx-store-direct': direct, 'fx-store-south': south };
const of = (storeKey: string): FixtureStore => STORES[storeKey] ?? direct;
const chipOf = (states: [string, string, string]): OrderChip => mapOrderStatus({ orderState: states[0], shipmentState: states[1], paymentState: states[2] });

export const fixtureDashboardPorts: DashboardPorts = {
  async openOrders(k) {
    return of(k).orders.filter((o) => o.states[0] === 'Open').length;
  },
  async recentOrders(k) {
    return of(k)
      .orders.slice(0, 5)
      .map<DashboardOrder>((o) => ({ id: `fx-o${o.n}`, orderNumber: `ORD-${o.n}`, createdAt: iso(o.daysAgo), customer: o.customer, total: eur(o.cents), chip: chipOf(o.states) }));
  },
  async openReturns(k) {
    return of(k).openReturns;
  },
  async returnsToHandle(k) {
    return of(k).returns;
  },
  async activeSubscriptions(k) {
    return of(k).subscriptions;
  },
  async renewals(k) {
    return of(k).renewals;
  },
  async unansweredReviews(k) {
    return of(k).reviews;
  },
  async lowStock(k) {
    return of(k).stock;
  },
  async headsUp(k) {
    const count = of(k).outOfStock;
    return count > 0 ? { kind: 'out-of-stock-everywhere', count, href: '/catalog?tab=assortment&stock=none' } : null;
  },
  async storePerformance(k): Promise<StorePerformance> {
    const store = of(k);
    // The same aggregation as the live module, fed with order-shaped fixtures.
    const orders = store.orders.map((o) => ({
      id: `fx-o${o.n}`,
      createdAt: iso(o.daysAgo),
      orderState: o.states[0],
      totalPrice: { centAmount: o.cents, currencyCode: 'EUR', fractionDigits: 2 },
      lineItems: o.lines.map(([sku, quantity, cents]) => ({ variant: { sku }, name: PARTS[sku], quantity, totalPrice: { centAmount: cents, currencyCode: 'EUR', fractionDigits: 2 } })),
    }));
    return aggregate(orders as never, new Date(), 30, false);
  },
  async storeHeader(k) {
    return of(k).header;
  },
};
