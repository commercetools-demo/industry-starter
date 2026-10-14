// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Customer, Order, PaymentMethod, RecurringOrder } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapAddresses, mapOrderListItem, mapPaymentMethod, mapProfile, mapReturns, mapSubscription, type PolicyDetail } from './account';

const customer = {
  id: 'c1',
  email: 'a@example.com',
  firstName: 'Anna',
  lastName: ' ',
  custom: { fields: { mobile: '+49 1', marketingConsent: true, garage: '{"x":1}', password: 'nope' } },
  addresses: [
    { id: 'a1', country: 'DE', city: 'Berlin' },
    { id: 'a2', country: 'DE', city: 'Hamburg' },
  ],
  defaultShippingAddressId: 'a2',
} as unknown as Customer;

describe('account mappers', () => {
  it('profile carries only names, email, mobile and the consent flag', () => {
    expect(mapProfile(customer)).toEqual({ email: 'a@example.com', firstName: 'Anna', lastName: null, mobile: '+49 1', marketingConsent: true });
  });
  it('the default address is flagged', () => {
    expect(mapAddresses(customer).map((a) => a.isDefault)).toEqual([false, true]);
  });
  it('order list item uses the order status, gross total and unit count', () => {
    const order = {
      orderNumber: 'MA-1',
      createdAt: '2026-10-01T00:00:00Z',
      orderState: 'Open',
      shipmentState: 'Shipped',
      totalPrice: { centAmount: 1000, currencyCode: 'EUR', fractionDigits: 2, type: 'centPrecision' },
      taxedPrice: { totalGross: { centAmount: 1190, currencyCode: 'EUR', fractionDigits: 2, type: 'centPrecision' } },
      lineItems: [{ quantity: 2 }, { quantity: 1 }],
    } as unknown as Order;
    expect(mapOrderListItem(order)).toMatchObject({ number: 'MA-1', status: 'shipped', itemCount: 3, total: { centAmount: 1190, currencyCode: 'EUR' } });
  });
  it('returns are grouped by return number with the portal status', () => {
    const order = {
      id: 'o1',
      orderNumber: 'MA-1',
      lineItems: [{ id: 'l1', name: { 'en-US': 'Pads' } }, { id: 'l2', name: { 'en-US': 'Wipers' } }],
      returnInfo: [
        {
          returnTrackingId: 'RT-20261012-ABCDE',
          returnDate: '2026-10-12T00:00:00Z',
          items: [
            { lineItemId: 'l1', quantity: 1, shipmentState: 'Advised', custom: { fields: { returnNumber: 'RET-MA-1-1', status: 'inspected', reason: 'wrong-fit' } } },
            { lineItemId: 'l2', quantity: 2, shipmentState: 'Advised', custom: { fields: { returnNumber: 'RET-MA-1-1', status: 'inspected', reason: 'wrong-fit' } } },
          ],
        },
      ],
    } as unknown as Order;
    const [r] = mapReturns(order, 'en-US');
    expect(r).toMatchObject({ returnNumber: 'RET-MA-1-1', tracking: 'RT-20261012-ABCDE', status: 'inspected', reason: 'wrong-fit' });
    expect(r.items).toEqual([
      { lineItemId: 'l1', name: 'Pads', quantity: 1 },
      { lineItemId: 'l2', name: 'Wipers', quantity: 2 },
    ]);
  });
  it('list never exposes raw token fields', () => {
    const method = { id: 'pm1', default: false, paymentMethodStatus: 'Active', token: { value: 'tok_secret' }, name: { 'en-US': 'Visa' }, custom: { fields: { last4: '4242', expiryMonth: 4, expiryYear: 2029 } } } as unknown as PaymentMethod;
    const view = mapPaymentMethod(method, 'en-US');
    expect(view).toEqual({ id: 'pm1', label: 'Visa', last4: '4242', expiry: '04/29', isDefault: false });
    expect(JSON.stringify(view)).not.toContain('tok_secret');
  });
});

const policies: PolicyDetail[] = [
  { id: 'p1', key: 'mau-rp-monthly', label: 'Every month', schedule: { type: 'standard', value: 1, intervalUnit: 'Months' } },
  { id: 'p3', key: 'mau-rp-quarterly', label: 'Every 3 months', schedule: { type: 'standard', value: 3, intervalUnit: 'Months' } },
];

describe('subscription mapper', () => {
  const base = {
    id: 'ro1',
    recurringOrderState: 'Active',
    nextOrderAt: '2026-11-01T00:00:00Z',
    schedule: { type: 'standard', value: 3, intervalUnit: 'Months' },
    originOrder: { typeId: 'order', id: 'o1', obj: { orderNumber: 'MA-9', lineItems: [{ name: { 'en-US': 'Oil filter' }, quantity: 2, recurrenceInfo: { recurrencePolicy: { id: 'p3' } }, variant: {} }] } },
  } as unknown as RecurringOrder;

  it('line items fall back to origin order', () => {
    expect(mapSubscription(base, policies, 'en-US').lines).toEqual([{ name: 'Oil filter', quantity: 2, imageUrl: null }]);
  });
  it('nextOrderAt is the API value', () => {
    expect(mapSubscription(base, policies, 'en-US').nextOrderAt).toBe('2026-11-01T00:00:00Z');
  });
  it('frequency comes from the recurrence policy name', () => {
    expect(mapSubscription(base, policies, 'en-US')).toMatchObject({ frequency: 'Every 3 months', policyKey: 'mau-rp-quarterly', orderNumber: 'MA-9' });
  });
  it('frequency falls back to the policy with the same schedule', () => {
    const ro = { ...base, originOrder: { typeId: 'order', id: 'o1', obj: { lineItems: [] } } } as unknown as RecurringOrder;
    expect(mapSubscription(ro, policies, 'en-US').frequency).toBe('Every 3 months');
  });
  it('states and pending skip', () => {
    const paused = { ...base, recurringOrderState: 'Paused', skipConfiguration: { type: 'Counter', totalToSkip: 2, skipped: 1 } } as unknown as RecurringOrder;
    expect(mapSubscription(paused, policies, 'en-US')).toMatchObject({ status: 'paused', skipPending: 1 });
    expect(mapSubscription({ ...base, recurringOrderState: 'Canceled' } as RecurringOrder, policies, 'en-US').status).toBe('canceled');
  });
});
