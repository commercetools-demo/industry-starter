import { describe, it, expect } from 'vitest';
import type { Order as CtOrder } from '@commercetools/platform-sdk';
import fixture from './__fixtures__/order.json';
import { itemSummary, mapOrder, mapOrderListItem, mapOrderStatus } from './order';

const ctx = { locale: 'en-US' };
type Json = Record<string, unknown>;
const order = (edit?: (o: Json) => void): CtOrder => {
  const copy = JSON.parse(JSON.stringify(fixture)) as Json;
  edit?.(copy);
  return copy as unknown as CtOrder;
};

describe('mapOrderStatus', () => {
  it.each([
    ['Cancelled', 'Pending', 'cancelled'],
    ['Cancelled', 'Delivered', 'cancelled'],
    ['Complete', 'Delivered', 'delivered'],
    ['Confirmed', 'Shipped', 'on-its-way'],
    ['Open', 'Ready', 'packing'],
    ['Open', 'Pending', 'processing'],
    ['Confirmed', undefined, 'processing'],
    ['Open', undefined, 'processing'],
    ['Complete', 'Pending', 'unknown'],
    ['Open', 'Delayed', 'unknown'],
    ['Open', 'Backorder', 'unknown'],
    [undefined, undefined, 'unknown'],
  ])('%s + %s -> %s', (orderState, shipmentState, expected) => {
    expect(mapOrderStatus(orderState, shipmentState)).toBe(expected);
  });
});

describe('itemSummary', () => {
  it('one, two and many names', () => {
    expect(itemSummary(['Milk'])).toBe('Milk');
    expect(itemSummary(['Milk', 'Bananas'])).toBe('Milk, Bananas');
    expect(itemSummary(['Whole milk', 'Bananas', 'Bread', 'Eggs'])).toBe('Whole milk, Bananas +2');
  });
  it('empty order', () => expect(itemSummary([])).toBe(''));
});

describe('mapOrder', () => {
  it('maps lines, totals, status and ownership fields', () => {
    const mapped = mapOrder(
      order((o) => {
        o.orderState = 'Confirmed';
        o.shipmentState = 'Ready';
      }),
      ctx,
    );
    expect(mapped).toMatchObject({
      id: 'order-1',
      orderNumber: 'MLV-1001',
      createdAt: '2026-10-05T10:30:00.000Z',
      status: 'packing',
      statusRaw: 'Confirmed/Ready',
      customerId: 'cust-1',
      version: 4,
      inventoryMode: 'None',
    });
    expect(mapped.subtotal).toEqual({ centAmount: 745, currencyCode: 'USD' });
    expect(mapped.total).toEqual({ centAmount: 1047, currencyCode: 'USD' });
    expect(mapped.tax).toEqual({ centAmount: 175, currencyCode: 'USD' });
    expect(mapped.shipping).toEqual({ centAmount: 302, currencyCode: 'USD' });
    expect(mapped.shippingAddress?.city).toBe('Austin');
    expect(mapped.lines).toHaveLength(2);
    expect(mapped.lines[0]).toMatchObject({ sku: 'BANANAS-500G', name: 'Bananas', quantity: 2, substitutionPreference: 'allow-similar', approximateWeight: true });
    expect(mapped.lines[1]).toMatchObject({ sku: 'MILK-1L', substitutionPreference: 'none' });
    expect(mapped.lines[1].unitPrice.discounted).toEqual({ centAmount: 149, currencyCode: 'USD' });
  });

  it('unknown state keeps the raw value', () => {
    const mapped = mapOrder(
      order((o) => {
        o.orderState = 'Complete';
        o.shipmentState = 'Pending';
      }),
      ctx,
    );
    expect(mapped.status).toBe('unknown');
    expect(mapped.statusRaw).toBe('Complete/Pending');
  });

  it('Provisional flag: true with an approximate-weight line, false without', () => {
    expect(mapOrder(order(), ctx).isProvisional).toBe(true);
    const plain = mapOrder(
      order((o) => {
        (o.lineItems as Json[]).shift();
      }),
      ctx,
    );
    expect(plain.isProvisional).toBe(false);
  });

  it('Slot and final total come from the custom fields', () => {
    const mapped = mapOrder(order(), ctx);
    expect(mapped.slot).toEqual({ id: '2026-10-12-09', start: '2026-10-12T09:00:00.000Z', end: '2026-10-12T11:00:00.000Z' });
    expect(mapped.finalTotal).toEqual({ centAmount: 1100, currencyCode: 'USD' });
  });

  it('no custom fields: no slot and no final total', () => {
    const mapped = mapOrder(
      order((o) => {
        delete o.custom;
        delete o.shippingInfo;
        delete o.taxedPrice;
      }),
      ctx,
    );
    expect(mapped.slot).toBeUndefined();
    expect(mapped.finalTotal).toBeUndefined();
    expect(mapped.shipping).toBeUndefined();
    expect(mapped.tax).toBeUndefined();
  });

  it('malformed finalTotal is ignored', () => {
    const mapped = mapOrder(
      order((o) => {
        (o.custom as { fields: Json }).fields.finalTotal = 'x';
      }),
      ctx,
    );
    expect(mapped.finalTotal).toBeUndefined();
  });
});

describe('mapOrderListItem', () => {
  it('maps the list row with the item summary and status', () => {
    expect(mapOrderListItem(order(), ctx)).toEqual({
      id: 'order-1',
      orderNumber: 'MLV-1001',
      createdAt: '2026-10-05T10:30:00.000Z',
      status: 'processing',
      total: { centAmount: 1047, currencyCode: 'USD' },
      itemSummary: 'Bananas, Whole milk 1 L',
    });
  });
});
