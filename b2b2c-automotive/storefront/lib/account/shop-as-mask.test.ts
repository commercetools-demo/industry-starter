// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { OrderView } from '@/lib/types';
import { maskOrderPage } from './shop-as-mask';

describe('C21: order pages while shopping as a customer', () => {
  const order = { id: 'o1', orderNumber: 'MA-1', customerEmail: 'anna.beispiel@example.de', shippingAddress: { country: 'DE', city: 'Berlin' }, billingAddress: { country: 'DE' } };
  const view = { number: 'MA-1', email: 'anna.beispiel@example.de', shipTo: { name: 'Anna', street: 'X 1', postalCode: '1', city: 'Berlin', country: 'DE' } } as unknown as OrderView;
  it('masks the e-mail and drops addresses, keeps the order number', () => {
    const masked = maskOrderPage({ order, view });
    const text = JSON.stringify(masked);
    expect(text).not.toContain('anna.beispiel');
    expect(text).not.toContain('Berlin');
    expect(masked.view.number).toBe('MA-1');
    expect(masked.view.email).toBe('a***@e***.de');
    expect(masked.order.shippingAddress).toBeUndefined();
  });
});
