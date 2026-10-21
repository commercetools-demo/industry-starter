import { describe, expect, it } from 'vitest';
import { mapOrderDetail, mapOrderListItem, returnableUnits, stateKeyOf } from '@/lib/mappers/account-order';
import { collectLine, ctLine, ctOrder } from '@/test/orders';

const NOW = new Date('2026-10-03T12:00:00.000Z');

describe('mapOrderListItem', () => {
  it('Ready for collection: status ready with the store, hours and directions point', () => {
    const o = mapOrderListItem(ctOrder({ lineItems: [collectLine('l1')], stateKey: 'ready-for-collection' }), 'en-US', NOW);
    expect(o.status).toBe('ready');
    expect(o.hasCollect).toBe(true);
    expect(o.hasShip).toBe(false);
    expect(o.collect).toEqual({ storeName: 'Malva SoHo', hours: '07:00–18:00', lat: 40.72, lng: -74 });
  });

  it('a delivery order has no collect block and counts units', () => {
    const o = mapOrderListItem(ctOrder({ lineItems: [ctLine('l1'), ctLine('l2', { quantity: 3 })], shipmentState: 'Shipped' }), 'en-US', NOW);
    expect(o.collect).toBeNull();
    expect(o.status).toBe('shipped');
    expect(o.itemCount).toBe(5);
    expect(o.totalCents).toBe(2000);
    expect(o.thumbs[0]).toEqual({ imageUrl: 'https://img.example.com/l1.jpg', name: 'Product l1' });
  });

  it('keeps five thumbnails at most', () => {
    const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((i) => ctLine(i));
    expect(mapOrderListItem(ctOrder({ lineItems: lines }), 'en-US', NOW).thumbs).toHaveLength(5);
  });

  it('Mixed order status prefers ready over shipped', () => {
    const o = mapOrderListItem(
      ctOrder({ lineItems: [collectLine('l1'), ctLine('l2')], stateKey: 'ready-for-collection', shipmentState: 'Shipped' }),
      'en-US', NOW,
    );
    expect(o.status).toBe('ready');
    expect(o.hasCollect && o.hasShip).toBe(true);
  });

  it('an order without a state is ordered', () => {
    expect(mapOrderListItem(ctOrder({ lineItems: [collectLine('l1')] }), 'en-US', NOW).status).toBe('ordered');
  });

  it('only the seeded state keys count', () => {
    expect(stateKeyOf(ctOrder({ stateKey: 'collected' }))).toBe('collected');
    expect(stateKeyOf(ctOrder({ stateKey: 'something-else' }))).toBeNull();
  });
});

describe('mapOrderDetail', () => {
  const shipped = (extra: Record<string, unknown> = {}) =>
    ctOrder({
      lineItems: [ctLine('l1', { quantity: 3 }), ctLine('l2')], shipmentState: 'Shipped',
      shippingInfo: { shippingMethodName: 'Standard', price: { type: 'centPrecision', currencyCode: 'USD', centAmount: 695, fractionDigits: 2 }, deliveries: [] },
      ...extra,
    });

  it('Partial shipment: one block per delivery, items distinguishable', () => {
    const d = mapOrderDetail(
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
    const d = mapOrderDetail(
      shipped({ shippingInfo: undefined, shipping: [{ shippingKey: 'a', shippingInfo: { deliveries: [delivery] } }, { shippingKey: 'b', shippingInfo: { deliveries: [delivery] } }] }),
      'en-US', NOW,
    );
    expect(d.deliveries).toHaveLength(1);
  });

  it('Refund state visible: goods received and refund are separate fields', () => {
    const d = mapOrderDetail(
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
    expect(mapOrderDetail(delivered, 'en-US', NOW).canReturn).toBe(true);
    expect(mapOrderDetail(delivered, 'en-US', new Date('2026-12-01T00:00:00.000Z')).canReturn).toBe(false);
    expect(mapOrderDetail(ctOrder({ shipmentState: 'Shipped' }), 'en-US', NOW).canReturn).toBe(false);
  });

  it('totals come from the order, collect orders carry the store address and no shipping address', () => {
    const d = mapOrderDetail(ctOrder({ lineItems: [collectLine('l1')], stateKey: 'ready-for-collection' }), 'en-US', NOW);
    expect(d.totalCents).toBe(2000);
    expect(d.taxCents).toBe(150);
    expect(d.collect).toMatchObject({ storeName: 'Malva SoHo', addressLine: '100 Example Street, New York', phone: '+1 212 555 0100' });
    expect(d.shippingAddress).toBeNull();
  });
});
