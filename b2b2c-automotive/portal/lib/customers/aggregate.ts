// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure aggregation of the Customers screen (V-01): registered customers and guest checkouts with their order numbers, lifetime
// value (cancelled orders excluded) and last order, plus the three KPIs.
import { maskEmail } from './mask';
import type { CustomerKpis, CustomerRow } from '@/lib/v-types';

export interface CustomerInput {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface OrderInput {
  id: string;
  customerId?: string;
  customerEmail?: string;
  orderState?: string;
  createdAt: string;
  totalPrice: { centAmount: number; currencyCode: string };
  shippingAddress?: { firstName?: string; lastName?: string };
}

const fullName = (first?: string, last?: string): string => [first?.trim(), last?.trim()].filter(Boolean).join(' ');

interface Bucket {
  row: CustomerRow;
  counted: number;
  /** Lower-case name and full e-mail, for the search only; never returned. */
  hay: string;
}

function add(bucket: Bucket, order: OrderInput): void {
  if (order.orderState === 'Cancelled') return;
  bucket.counted += 1;
  bucket.row.orders = bucket.counted;
  bucket.row.lifetimeCents += order.totalPrice.centAmount;
  bucket.row.currency = order.totalPrice.currencyCode;
  if (!bucket.row.lastOrderAt || order.createdAt > bucket.row.lastOrderAt) bucket.row.lastOrderAt = order.createdAt;
}

/**
 * Rows (registered first by sign-up date, then guests by last order) and KPIs. Guests are grouped by e-mail address. `query` keeps
 * the rows whose name or e-mail contains it (case-insensitive); the KPIs always describe the whole store.
 */
export function aggregate(customers: readonly CustomerInput[], orders: readonly OrderInput[], query?: string): { rows: CustomerRow[]; kpis: CustomerKpis } {
  const registered = new Map<string, Bucket>();
  for (const c of customers) {
    registered.set(c.id, {
      counted: 0,
      hay: `${fullName(c.firstName, c.lastName)} ${c.email}`.toLowerCase(),
      row: { id: c.id, name: fullName(c.firstName, c.lastName) || maskEmail(c.email), email: maskEmail(c.email), type: 'Registered', orders: 0, lifetimeCents: 0, currency: '', lastOrderAt: null },
    });
  }
  const guests = new Map<string, Bucket>();
  for (const order of orders) {
    if (order.customerId) {
      const bucket = registered.get(order.customerId);
      if (bucket) add(bucket, order);
      continue;
    }
    const email = (order.customerEmail ?? '').trim().toLowerCase() || `order:${order.id}`;
    let bucket = guests.get(email);
    if (!bucket) {
      bucket = {
        counted: 0,
        hay: `${fullName(order.shippingAddress?.firstName, order.shippingAddress?.lastName)} ${email}`.toLowerCase(),
        row: {
          id: null,
          name: fullName(order.shippingAddress?.firstName, order.shippingAddress?.lastName) || (email.includes('@') ? maskEmail(email) : '-'),
          email: email.includes('@') ? maskEmail(email) : '',
          type: 'Guest',
          orders: 0,
          lifetimeCents: 0,
          currency: '',
          lastOrderAt: null,
        },
      };
      guests.set(email, bucket);
    }
    add(bucket, order);
  }
  const needle = query?.trim().toLowerCase();
  const keep = (b: Bucket) => !needle || b.hay.includes(needle);
  const regRows = [...registered.values()].map((b) => b.row);
  const guestRows = [...guests.values()].map((b) => b.row).sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''));
  const everyone = [...regRows, ...guestRows];
  const visible = new Set([...registered.values(), ...guests.values()].filter(keep).map((b) => b.row));
  const withOrders = everyone.filter((r) => r.orders >= 1).length;
  const repeat = everyone.filter((r) => r.orders >= 2).length;
  return {
    rows: everyone.filter((r) => visible.has(r)),
    kpis: { registered: regRows.length, guests: guestRows.length, repeatRate: withOrders === 0 ? 0 : Math.round((repeat / withOrders) * 1000) / 10 },
  };
}
