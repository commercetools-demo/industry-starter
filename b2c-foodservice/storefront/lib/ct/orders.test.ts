import type { Order } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canViewOrder } from '@/lib/checkout/order-access';
import { mapOrder, mapOrderState } from '@/lib/mappers/order';
import { ctLine } from '@/test/cart';

const h = vi.hoisted(() => ({ order: null as unknown, posts: [] as unknown[], conflicts: 0 }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    orders: () => ({
      get: () => ({ execute: async () => ({ body: { results: [{ id: 'o-b', orderNumber: 'MC-ABCDEFGHJK-B' }] } }) }),
      withId: () => ({
        get: () => ({ execute: async () => ({ body: h.order }) }),
        post: ({ body }: { body: unknown }) => ({
          execute: async () => {
            if (h.conflicts > 0) {
              h.conflicts -= 1;
              throw Object.assign(new Error('c'), { statusCode: 409 });
            }
            h.posts.push(body);
            return { body: { ...(h.order as object), state: { obj: { key: 'mcf-order-ordered' } } } };
          },
        }),
      }),
    }),
  },
}));

import { ensureOrderState, getLinkedOrders } from './orders';

const channel = {
  id: 'ch-soho', key: 'mcf-store-nyc-soho', roles: ['InventorySupply'], name: { 'en-US': 'Malva SoHo' },
  address: { country: 'US', streetName: 'Prince Street', streetNumber: '148', city: 'New York', postalCode: '10012' },
  custom: { fields: { collectionMinutes: 20, phone: '+1 212 555 0101' } },
};
const policy = { schedule: { type: 'standard', value: 2, intervalUnit: 'Weeks' } };

function order(over: Record<string, unknown> = {}): Order {
  const lines = (over.lines as ReturnType<typeof ctLine>[] | undefined) ?? [ctLine({ id: 'l1', sku: 'A' })];
  const { lines: _l, ...rest } = over;
  void _l;
  return {
    id: 'o1', version: 2, orderNumber: 'MC-ABCDEFGHJK', createdAt: '2026-10-21T10:00:00.000Z', locale: 'en-US', customerEmail: 'a@example.com',
    lineItems: lines, totalPrice: { type: 'centPrecision', centAmount: 1000, currencyCode: 'USD', fractionDigits: 2 },
    taxedPrice: { totalNet: { centAmount: 1695 }, totalGross: { centAmount: 1815, currencyCode: 'USD' }, totalTax: { centAmount: 120, currencyCode: 'USD' } },
    shippingInfo: { shippingMethodName: 'Standard', price: { centAmount: 695, currencyCode: 'USD' }, shippingMethod: { obj: { key: 'mcf-ship-standard', localizedDescription: { 'en-US': '2-4 business days' } } }, deliveries: [] },
    shippingAddress: { country: 'US', city: 'Brooklyn', streetName: 'Main St', streetNumber: '1', postalCode: '11201' },
    paymentState: 'Paid', ...rest,
  } as unknown as Order;
}
const ctx = { locale: 'en-US', now: new Date('2026-10-21T15:00:00Z') };

beforeEach(() => {
  h.posts = [];
  h.conflicts = 0;
});

describe('mapOrder', () => {
  it('Ready', () => {
    expect(mapOrderState('mcf-order-ready-for-collection')).toBe('ready-for-collection');
    expect(mapOrder(order({ state: { obj: { key: 'mcf-order-ready-for-collection' } } }), ctx).state).toBe('ready-for-collection');
  });
  it('Unknown state key maps to null', () => {
    expect(mapOrderState('something-else')).toBeNull();
    expect(mapOrderState(undefined)).toBeNull();
  });
  it('Mixed order has collect and ship parts', () => {
    const o = order({
      lines: [ctLine({ id: 'c', sku: 'P', fulfilment: 'collect', channelId: 'ch-soho' }), ctLine({ id: 's', sku: 'M' })],
    });
    (o.lineItems[0] as unknown as { supplyChannel: unknown }).supplyChannel = { typeId: 'channel', id: 'ch-soho', obj: channel };
    const v = mapOrder(o, ctx);
    expect(v.collect.map((c) => c.storeKey)).toEqual(['mcf-store-nyc-soho']);
    expect(v.ship?.methodName).toBe('Standard');
    expect(v.lines.map((l) => [l.id, l.fulfilment])).toEqual([['c', 'collect'], ['s', 'delivery']]);
  });
  it('a collect order carries the pickup name on its address', () => {
    const o = order({
      lines: [ctLine({ id: 'c', sku: 'P', fulfilment: 'collect', channelId: 'ch-soho' })],
      shippingInfo: { shippingMethodName: 'Collect', price: { centAmount: 0, currencyCode: 'USD' }, shippingMethod: { obj: { key: 'mcf-collect' } } },
      shippingAddress: { country: 'US', firstName: 'Maya', lastName: 'Lopez' },
    });
    (o.lineItems[0] as unknown as { supplyChannel: unknown }).supplyChannel = { typeId: 'channel', id: 'ch-soho', obj: channel };
    const v = mapOrder(o, ctx);
    expect(v.collect[0]).toMatchObject({ pickupName: 'Maya Lopez', readyMinutes: 20 });
    expect(v.ship).toBeNull();
  });
  it('Shipped line with no tracking has an estimate and no parcel', () => {
    const v = mapOrder(order(), ctx);
    expect(v.ship).toMatchObject({ estimate: '2-4 business days', deliveries: [] });
  });
  it('Subscription line shows the interval', () => {
    const o = order({ lines: [ctLine({ id: 'u', sku: 'S', fulfilment: 'subscribe', policyId: 'pol' })] });
    (o.lineItems[0] as unknown as { recurrenceInfo: { recurrencePolicy: unknown } }).recurrenceInfo.recurrencePolicy = { typeId: 'recurrence-policy', id: 'pol', obj: policy };
    expect(mapOrder(o, ctx).subscriptions).toEqual([{ lineId: 'u', schedule: { unit: 'Weeks', value: 2 } }]);
  });
  it('Revisited later: works from the order alone, with the stored totals', () => {
    const v = mapOrder(order(), ctx);
    expect(v.totals).toMatchObject({ shippingCents: 695, taxCents: 120, totalCents: 1815 });
    expect(v.orderNumber).toBe('MC-ABCDEFGHJK');
    expect(v.email).toBe('a@example.com');
  });
});

describe('ensureOrderState', () => {
  it('ensureOrderState sets ordered once', async () => {
    h.order = order();
    const done = await ensureOrderState(order());
    expect(h.posts).toHaveLength(1);
    expect(JSON.stringify(h.posts[0])).toContain('mcf-order-ordered');
    expect(done.state).toBeDefined();
    await ensureOrderState(order({ state: { typeId: 'state', id: 's' } }));
    expect(h.posts).toHaveLength(1);
  });
  it('a conflict re-reads and tries again', async () => {
    h.order = order();
    h.conflicts = 1;
    await ensureOrderState(order());
    expect(h.posts).toHaveLength(1);
  });
  it('a failure leaves the order as it was', async () => {
    h.order = order();
    h.conflicts = 5;
    const o = order();
    expect(await ensureOrderState(o)).toBe(o);
  });
});

describe('access and links', () => {
  it('Order of another customer returns 404 identical to unknown', () => {
    expect(canViewOrder({ customerId: 'cust-1' }, { customerId: 'cust-2' })).toBe(false);
    expect(canViewOrder({ customerId: 'cust-1' }, {})).toBe(false);
    expect(canViewOrder({ customerId: 'cust-1' }, { customerId: 'cust-1' })).toBe(true);
    expect(canViewOrder({ customerId: null }, {})).toBe(true);
  });
  it('links the other parts of one purchase and refuses a foreign number', async () => {
    expect(await getLinkedOrders('MC-ABCDEFGHJK-A')).toEqual([{ id: 'o-b', orderNumber: 'MC-ABCDEFGHJK-B' }]);
    expect(await getLinkedOrders('hand-made"; x')).toEqual([]);
  });
});
