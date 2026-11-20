import { describe, expect, it } from 'vitest';
import { mapOrder, mapOrderState, returnableUnits } from '@/lib/mappers/order';
import { collectLine, ctLine, ctOrder } from '@/test/orders';

const NOW = new Date('2026-10-03T12:00:00.000Z');
import type { Order } from '@commercetools/platform-sdk';
const view = (o: Order, _locale: string, now: Date) => mapOrder(o, { locale: 'en-US', now });

describe('mapOrder (account list fields)', () => {
  it('Ready for collection: status ready with the store, hours and directions point', () => {
    const o = view(ctOrder({ lineItems: [collectLine('l1')], stateKey: 'ready-for-collection' }), 'en-US', NOW);
    expect(o.status).toBe('ready');
    expect(o.hasCollect).toBe(true);
    expect(o.hasShip).toBe(false);
    expect(o.collect[0]).toMatchObject({ storeName: 'Malva SoHo', hours: '07:00–18:00', lat: 40.72, lng: -74 });
  });

  it('a delivery order has no collect block and counts units', () => {
    const o = view(ctOrder({ lineItems: [ctLine('l1'), ctLine('l2', { quantity: 3 })], shipmentState: 'Shipped' }), 'en-US', NOW);
    expect(o.collect).toEqual([]);
    expect(o.status).toBe('shipped');
    expect(o.lines.reduce((n, l) => n + l.quantity, 0)).toBe(5);
    expect(o.totals.totalCents).toBe(2000);
    expect(o.lines[0]).toMatchObject({ imageUrl: 'https://img.example.com/l1.jpg', name: 'Product l1' });
  });

    it('Mixed order status prefers ready over shipped', () => {
    const o = view(
      ctOrder({ lineItems: [collectLine('l1'), ctLine('l2')], stateKey: 'ready-for-collection', shipmentState: 'Shipped' }),
      'en-US', NOW,
    );
    expect(o.status).toBe('ready');
    expect(o.hasCollect && o.hasShip).toBe(true);
  });

  it('an order without a state is ordered', () => {
    expect(view(ctOrder({ lineItems: [collectLine('l1')] }), 'en-US', NOW).status).toBe('ordered');
  });

  it('only the seeded state keys count', () => {
    expect(mapOrderState(ctOrder({ stateKey: 'collected' }).state?.obj?.key)).toBe('collected');
    expect(mapOrderState('mcf-order-something-else')).toBeNull();
    expect(mapOrderState(undefined)).toBeNull();
  });
});

describe('mapOrder (account detail fields)', () => {
  const shipped = (extra: Record<string, unknown> = {}) =>
    ctOrder({
      lineItems: [ctLine('l1', { quantity: 3 }), ctLine('l2')], shipmentState: 'Shipped',
      shippingInfo: { shippingMethodName: 'Standard', price: { type: 'centPrecision', currencyCode: 'USD', centAmount: 695, fractionDigits: 2 }, deliveries: [] },
      ...extra,
    });

  it('Partial shipment: one block per delivery, items distinguishable', () => {
    const d = view(
      shipped({
        shippingInfo: {
          price: { type: 'centPrecision', currencyCode: 'USD', centAmount: 695, fractionDigits: 2 },
          deliveries: [
            { id: 'd1', createdAt: '2026-10-02T00:00:00.000Z', items: [{ id: 'l1', quantity: 2 }], parcels: [{ id: 'p1', createdAt: 'x', trackingData: { trackingId: '1Z999', carrier: 'UPS' } }] },
            { id: 'd2', createdAt: '2026-10-03T00:00:00.000Z', items: [{ id: 'l1', quantity: 1 }, { id: 'l2', quantity: 1 }], parcels: [] },
          ],
        },
      }),
      'en-US', NOW,
    );
    expect(d.deliveries).toHaveLength(2);
    expect(d.deliveries[0]).toMatchObject({ id: 'd1', carrier: 'UPS', trackingId: '1Z999', items: [{ lineId: 'l1', name: 'Product l1', quantity: 2 }] });
    expect(d.deliveries[0].trackingUrl).toContain('1Z999');
    expect(d.deliveries[1].items.map((i) => i.lineId)).toEqual(['l1', 'l2']);
    expect(d.deliveries[1].trackingId).toBeNull();
  });

  it('reads deliveries of a multiple-shipping order too, without duplicates', () => {
    const delivery = { id: 'd1', createdAt: 'x', items: [{ id: 'l1', quantity: 1 }], parcels: [] };
    const d = view(
      shipped({ shippingInfo: undefined, shipping: [{ shippingKey: 'a', shippingInfo: { deliveries: [delivery] } }, { shippingKey: 'b', shippingInfo: { deliveries: [delivery] } }] }),
      'en-US', NOW,
    );
    expect(d.deliveries).toHaveLength(1);
  });

  it('Refund state visible: goods received and refund are separate fields', () => {
    const d = view(
      ctOrder({
        shipmentState: 'Delivered',
        returnInfo: [{ returnDate: '2026-10-05T00:00:00.000Z', returnTrackingId: 'RT1', items: [
          { id: 'ri1', type: 'LineItemReturnItem', lineItemId: 'l1', quantity: 1, comment: 'Damaged', shipmentState: 'Returned', paymentState: 'Refunded', createdAt: 'x', lastModifiedAt: 'x' },
        ] }],
      }),
      'en-US', NOW,
    );
    expect(d.returns[0].items[0]).toMatchObject({ lineId: 'l1', reason: 'Damaged', shipmentState: 'Returned', paymentState: 'Refunded' });
    expect(d.returns[0].trackingId).toBe('RT1');
  });

  it('computes units still returnable from returnInfo', () => {
    const order = ctOrder({
      lineItems: [ctLine('l1', { quantity: 3 }), ctLine('l2', { quantity: 1 })],
      returnInfo: [{ items: [{ id: 'r', type: 'LineItemReturnItem', lineItemId: 'l1', quantity: 2, shipmentState: 'Advised', paymentState: 'Initial' }] }],
    });
    expect(returnableUnits(order)).toEqual({ l1: 1, l2: 1 });
  });

  it('is returnable only when completed and inside the window', () => {
    const delivered = ctOrder({ shipmentState: 'Delivered', lastModifiedAt: '2026-10-02T10:00:00.000Z' });
    expect(view(delivered, 'en-US', NOW).canReturn).toBe(true);
    expect(view(delivered, 'en-US', new Date('2026-12-01T00:00:00.000Z')).canReturn).toBe(false);
    expect(view(ctOrder({ shipmentState: 'Shipped' }), 'en-US', NOW).canReturn).toBe(false);
  });

  it('totals come from the order, collect orders carry the store address and no shipping address', () => {
    const d = view(ctOrder({ lineItems: [collectLine('l1')], stateKey: 'ready-for-collection' }), 'en-US', NOW);
    expect(d.totals.totalCents).toBe(2000);
    expect(d.totals.taxCents).toBe(150);
    expect(d.collect[0]).toMatchObject({ storeName: 'Malva SoHo', address: '100 Example Street, New York', phone: '+1 212 555 0100' });
    expect(d.ship?.recipient ?? null).toBeNull();
  });
});

describe('mapOrder orderType (workstream R)', () => {
  it('exposes the order type custom field when it holds a known value', () => {
    const custom = (v: unknown) => ({ custom: { type: { typeId: 'type', id: 't' }, fields: { orderType: v } } });
    expect(view(ctOrder(custom('in-store-purchase')), 'en-US', NOW).orderType).toBe('in-store-purchase');
    expect(view(ctOrder(custom('online')), 'en-US', NOW).orderType).toBe('online');
  });
  it('leaves it out for an unknown value and for an order without custom fields', () => {
    expect('orderType' in view(ctOrder({ custom: { type: { typeId: 'type', id: 't' }, fields: { orderType: 'x' } } }), 'en-US', NOW)).toBe(false);
    expect('orderType' in view(ctOrder(), 'en-US', NOW)).toBe(false);
  });
});
