import type { Cart, LineItem, Order, RecurringOrder } from '@commercetools/platform-sdk';
import type { Subscription } from '@/lib/types';
import { ctLine } from '@/test/orders';

/** Test data for subscriptions (workstream N): commercetools-shaped recurring orders and view-shaped subscriptions. */
export const POLICY_1M = '11111111-1111-4111-8111-111111111111';
export const POLICY_2W = '22222222-2222-4222-8222-222222222222';
export const RO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const CUSTOMER = 'cust-1';

const money = (centAmount: number) => ({ type: 'centPrecision' as const, currencyCode: 'USD', centAmount, fractionDigits: 2 });

export const recurringLine = (id: string, policyId = POLICY_1M, over: Record<string, unknown> = {}): LineItem =>
  ctLine(id, {
    quantity: 2,
    price: { id: 'pr', value: money(2205) },
    totalPrice: money(4410),
    variant: {
      id: 1, sku: `SKU-${id}`, images: [{ url: `https://img.example.com/${id}.jpg`, dimensions: { w: 1, h: 1 } }],
      attributes: [{ name: 'capsulesPerPack', value: 50 }],
    },
    recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: policyId }, priceSelectionMode: 'Fixed' },
    ...over,
  });

export function ctCart(lines: LineItem[] = [recurringLine('l1')]): Cart {
  return { id: 'rc-1', version: 1, lineItems: lines, totalPrice: money(lines.reduce((s, l) => s + l.totalPrice.centAmount, 0)) } as unknown as Cart;
}

export function ctOriginOrder(over: Record<string, unknown> = {}): Order {
  return { id: 'o-1', orderNumber: 'MC-10042', createdAt: '2026-10-19T08:00:00.000Z', lineItems: [recurringLine('l1')], ...over } as unknown as Order;
}

export function ctRecurringOrder(over: Record<string, unknown> = {}): RecurringOrder {
  return {
    id: RO_ID, version: 3, createdAt: '2026-10-19T08:00:00.000Z', startsAt: '2026-10-19T08:00:00.000Z', nextOrderAt: '2026-11-19T08:00:00.000Z',
    recurringOrderState: 'Active', schedule: { type: 'standard', value: 1, intervalUnit: 'Months' },
    customer: { typeId: 'customer', id: CUSTOMER },
    cart: { typeId: 'cart', id: 'rc-1', obj: ctCart() },
    originOrder: { typeId: 'order', id: 'o-1', obj: ctOriginOrder() },
    ...over,
  } as unknown as RecurringOrder;
}

export function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    id: RO_ID, version: 3, state: 'active', policyId: POLICY_1M, schedule: { unit: 'Months', value: 1 },
    nextOrderDate: '2026-11-19T08:00:00.000Z', lastOrderDate: null, startedAt: '2026-10-19T08:00:00.000Z', pendingSkips: 0,
    priceSelectionMode: 'fixed',
    lines: [{
      lineId: 'l1', sku: 'SKU-l1', productId: 'p-l1', slug: 'pods', name: 'Product l1', variantLabel: '50 capsules',
      imageUrl: 'https://img.example.com/l1.jpg', quantity: 2, unitPrice: { centAmount: 2205, currencyCode: 'USD' }, totalPrice: { centAmount: 4410, currencyCode: 'USD' },
    }],
    total: { centAmount: 4410, currencyCode: 'USD' }, originOrderId: 'o-1', originOrderNumber: 'MC-10042',
    ...over,
  };
}
