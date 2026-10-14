/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { aggregate, type CustomerInput, type OrderInput } from './aggregate';

const customers: CustomerInput[] = [
  { id: 'c1', email: 'anna@example.com', firstName: 'Anna', lastName: 'Muster', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'c2', email: 'ben@example.com', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'c3', email: 'cem@example.com', createdAt: '2026-03-01T00:00:00Z' },
];
const order = (id: string, over: Partial<OrderInput>): OrderInput => ({ id, createdAt: '2026-05-01T00:00:00Z', totalPrice: { centAmount: 1000, currencyCode: 'EUR' }, orderState: 'Complete', ...over });

describe('aggregate customers', () => {
  it('lifetime value excludes cancelled orders and keeps the latest order date', () => {
    const { rows } = aggregate(customers, [
      order('o1', { customerId: 'c1', totalPrice: { centAmount: 2500, currencyCode: 'EUR' }, createdAt: '2026-04-01T00:00:00Z' }),
      order('o2', { customerId: 'c1', createdAt: '2026-06-01T00:00:00Z' }),
      order('o3', { customerId: 'c1', orderState: 'Cancelled', totalPrice: { centAmount: 99999, currencyCode: 'EUR' } }),
    ]);
    const anna = rows.find((r) => r.id === 'c1');
    expect(anna).toMatchObject({ name: 'Anna Muster', orders: 2, lifetimeCents: 3500, lastOrderAt: '2026-06-01T00:00:00Z', type: 'Registered', email: 'a***@e***.com' });
  });
  it('groups guests by e-mail address and computes the repeat rate', () => {
    const { rows, kpis } = aggregate(customers, [
      order('o1', { customerId: 'c1' }),
      order('o2', { customerId: 'c1' }),
      order('o3', { customerId: 'c2' }),
      order('o4', { customerEmail: 'Gast@example.com' }),
      order('o5', { customerEmail: 'gast@example.com' }),
      order('o6', { customerEmail: 'other@example.com' }),
    ]);
    const guests = rows.filter((r) => r.type === 'Guest');
    expect(guests).toHaveLength(2);
    expect(guests.find((g) => g.orders === 2)).toBeTruthy();
    expect(kpis).toEqual({ registered: 3, guests: 2, repeatRate: 50 });
  });
  it('shows no repeat rate before the first order', () => {
    expect(aggregate(customers, []).kpis.repeatRate).toBe(0);
  });
});
