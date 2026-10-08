import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { orderA, orderDevice } from '@/test/fixtures/orders';
import { mapOrder, parseCancellation } from './order';

/** An order with two deliveries (three parcels) and a return of the handset. */
function shipped(order: CtOrder, extra: Record<string, unknown> = {}): CtOrder {
  return {
    ...order,
    shippingInfo: {
      deliveries: [
        {
          id: 'del-1',
          createdAt: '2026-03-08T09:00:00.000Z',
          items: [{ id: 'a1', quantity: 1 }],
          parcels: [
            { id: 'par-1', createdAt: '2026-03-08T09:00:00.000Z', trackingData: { trackingId: 'DP000111', carrier: 'DemoPost' }, items: [{ id: 'a1', quantity: 1 }] },
            { id: 'par-2', createdAt: '2026-03-08T09:00:00.000Z', items: [] },
          ],
        },
        {
          id: 'del-2',
          createdAt: '2026-03-09T09:00:00.000Z',
          items: [{ id: 'a2', quantity: 1 }],
          parcels: [{ id: 'par-3', createdAt: '2026-03-09T09:00:00.000Z', trackingData: { trackingId: 'DP000333', carrier: 'DemoPost' } }],
        },
      ],
    },
    ...extra,
  } as unknown as CtOrder;
}

describe('mapOrder: post-purchase fields', () => {
  it('maps deliveries, parcels and tracking references with the line names', () => {
    const order = mapOrder(shipped(orderA()), 'en-US');
    expect(order.deliveries).toHaveLength(2);
    expect(order.deliveries[0]).toMatchObject({ id: 'del-1', items: [{ lineItemId: 'a1', name: 'Cable 500', quantity: 1 }] });
    expect(order.deliveries[0]?.parcels[0]).toEqual({ id: 'par-1', trackingId: 'DP000111', carrier: 'DemoPost', items: [{ lineItemId: 'a1', name: 'Cable 500', quantity: 1 }] });
    expect(order.deliveries[0]?.parcels[1]).toEqual({ id: 'par-2', items: [] });
    expect(order.deliveries[1]?.parcels[0]?.items).toEqual([]);
    expect(order.deliveries.flatMap((delivery) => delivery.parcels)).toHaveLength(3);
  });

  it('maps return items with their own goods and refund state', () => {
    const ct = {
      ...orderDevice(),
      returnInfo: [
        {
          returnDate: '2026-05-03T10:00:00.000Z',
          items: [
            { id: 'ri-1', type: 'LineItemReturnItem', lineItemId: 'd2', quantity: 1, comment: 'defective', shipmentState: 'Advised', paymentState: 'NonRefundable' },
            { id: 'ri-2', type: 'LineItemReturnItem', lineItemId: 'd2', quantity: 1, shipmentState: 'Returned', paymentState: 'Initial' },
            { id: 'ri-3', type: 'CustomLineItemReturnItem', customLineItemId: 'x', quantity: 1, shipmentState: 'Returned', paymentState: 'Initial' },
          ],
        },
      ],
    } as unknown as CtOrder;
    const order = mapOrder(ct, 'en-US');
    expect(order.returns).toHaveLength(1);
    expect(order.returns[0]?.returnDate).toBe('2026-05-03T10:00:00.000Z');
    expect(order.returns[0]?.items).toEqual([
      { id: 'ri-1', lineItemId: 'd2', name: 'Nova Pro', quantity: 1, comment: 'defective', shipmentState: 'Advised', paymentState: 'NonRefundable' },
      { id: 'ri-2', lineItemId: 'd2', name: 'Nova Pro', quantity: 1, shipmentState: 'Returned', paymentState: 'Initial' },
    ]);
  });

  it('reads the cancellation record and ignores bad JSON in the custom fields', () => {
    const record = { reason: 'other', note: 'moving abroad', cancelledAt: '2026-03-08T10:00:00.000Z', by: 'customer' };
    const base = orderA();
    const fields = (base.custom?.fields ?? {}) as Record<string, unknown>;
    const withRecord = { ...base, custom: { ...base.custom, fields: { ...fields, cancellation: JSON.stringify(record) } } } as unknown as CtOrder;
    expect(mapOrder(withRecord, 'en-US').cancellation).toEqual(record);
    const broken = { ...base, custom: { ...base.custom, fields: { ...fields, cancellation: '{oops', labelSnapshot: 'nope' } } } as unknown as CtOrder;
    const mapped = mapOrder(broken, 'en-US');
    expect(mapped.cancellation).toBeUndefined();
    expect(mapped.etfByLine).toEqual({});
    expect(parseCancellation(JSON.stringify({ reason: 'bored', cancelledAt: 'x' }))).toBeUndefined();
  });

  it('reads the early-termination fee text from the stored label, by line', () => {
    const order = mapOrder(orderA(), 'en-US');
    expect(order.etfByLine).toEqual({ a1: 'None' });
    expect(order.deliveries).toEqual([]);
    expect(order.returns).toEqual([]);
  });
});
