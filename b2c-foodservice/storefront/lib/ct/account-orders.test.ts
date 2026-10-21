// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  statesGet: vi.fn(),
  ordersGet: vi.fn(),
  ordersPost: vi.fn(),
  orderGet: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({}) }));
vi.mock('@/lib/ct/public-cache', () => ({ cachedPublic: (_k: string, _p: string[], fn: unknown) => fn }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    states: () => ({ get: (a: unknown) => ({ execute: () => sdk.statesGet(a) }) }),
    orders: () => ({
      get: (a: unknown) => ({ execute: () => sdk.ordersGet(a) }),
      withId: () => ({
        get: (a: unknown) => ({ execute: () => sdk.orderGet(a) }),
        post: (a: unknown) => ({ execute: () => sdk.ordersPost(a) }),
      }),
      withOrderNumber: () => ({ get: (a: unknown) => ({ execute: () => sdk.orderGet(a) }) }),
    }),
  },
}));

import { addReturn, buildOrderQuery, countOrders, getOrderByNumber, getOrderStateIds, listOrders } from '@/lib/ct/account-orders';
import { ctOrder } from '@/test/orders';

const IDS = { ordered: 's1', preparing: 's2', 'ready-for-collection': 's3', collected: 's4' };

beforeEach(() => {
  for (const f of Object.values(sdk)) f.mockReset();
  sdk.statesGet.mockResolvedValue({
    body: { results: [
      { id: 's1', key: 'mcf-order-ordered' }, { id: 's2', key: 'mcf-order-preparing' },
      { id: 's3', key: 'mcf-order-ready-for-collection' }, { id: 's4', key: 'mcf-order-collected' },
    ] },
  });
  sdk.ordersGet.mockResolvedValue({ body: { results: [], total: 0 } });
});

describe('order queries', () => {
  it('Own orders only: the predicate always carries the customer id, for every filter', () => {
    for (const filter of ['all', 'in-progress', 'ready', 'completed'] as const) {
      const q = buildOrderQuery('c1', filter, IDS);
      expect(q.where.startsWith('customerId=:id')).toBe(true);
      expect(q.vars.id).toBe('c1');
    }
  });

  it('Filter ready uses the ready state id', () => {
    const q = buildOrderQuery('c1', 'ready', IDS);
    expect(q.where).toBe('customerId=:id and state(id=:ready)');
    expect(q.vars.ready).toBe('s3');
  });

  it('completed and in-progress use the collected state and the delivered shipment state', () => {
    expect(buildOrderQuery('c1', 'completed', IDS).where).toContain('shipmentState="Delivered"');
    const open = buildOrderQuery('c1', 'in-progress', IDS);
    expect(open.where).toContain('not(state(id=:done))');
    expect(open.where).toContain('orderState!="Cancelled"');
    expect(open.vars.done).toBe('s4');
  });

  it('a customer id is a variable, never concatenated', () => {
    const q = buildOrderQuery('c1" or customerId!="x', 'all', IDS);
    expect(q.where).toBe('customerId=:id');
  });

  it('State ids come from the cached lookup not constants', async () => {
    expect(await getOrderStateIds()).toEqual(IDS);
    expect(sdk.statesGet.mock.calls[0][0].queryArgs.where).toContain('type="OrderState"');
    await listOrders('c1', { filter: 'ready', limit: 10, offset: 0 });
    expect(sdk.ordersGet.mock.calls[0][0].queryArgs['var.ready']).toBe('s3');
  });

  it('History is paged across all orders', async () => {
    sdk.ordersGet.mockResolvedValue({ body: { results: [ctOrder()], total: 37 } });
    const page = await listOrders('c1', { filter: 'all', limit: 10, offset: 20 });
    expect(page.total).toBe(37);
    const args = sdk.ordersGet.mock.calls[0][0].queryArgs;
    expect(args).toMatchObject({ limit: 10, offset: 20, withTotal: true, sort: 'createdAt desc', 'var.id': 'c1' });
    expect(args.expand).toEqual(expect.arrayContaining(['state', 'lineItems[*].supplyChannel']));
  });

  it('counts with one row and withTotal', async () => {
    sdk.ordersGet.mockResolvedValue({ body: { results: [ctOrder()], total: 5 } });
    expect(await countOrders('c1', 'in-progress')).toBe(5);
    expect(sdk.ordersGet.mock.calls.at(-1)?.[0].queryArgs).toMatchObject({ limit: 1, withTotal: true });
  });
});

describe('order reads', () => {
  it('Detail of an order not theirs: a foreign order is null, like an unknown one', async () => {
    sdk.orderGet.mockResolvedValue({ body: ctOrder({ customerId: 'someone-else' }) });
    expect(await getOrderByNumber('c1', 'MC-1001')).toBeNull();
    sdk.orderGet.mockRejectedValue({ statusCode: 404 });
    expect(await getOrderByNumber('c1', 'MC-9999')).toBeNull();
  });

  it('returns the order of the owner', async () => {
    sdk.orderGet.mockResolvedValue({ body: ctOrder() });
    expect((await getOrderByNumber('c1', 'MC-1001'))?.orderNumber).toBe('MC-1001');
  });

  it('Return started: addReturnInfo carries line ids, quantities and Advised', async () => {
    sdk.orderGet.mockResolvedValue({ body: ctOrder({ version: 7 }) });
    sdk.ordersPost.mockResolvedValue({ body: ctOrder({ version: 8 }) });
    await addReturn('o1', [{ lineId: 'l1', quantity: 1, reason: 'Damaged' }, { lineId: 'l2', quantity: 2 }], new Date('2026-10-05T00:00:00.000Z'));
    const body = sdk.ordersPost.mock.calls[0][0].body;
    expect(body.version).toBe(7);
    expect(body.actions).toEqual([
      {
        action: 'addReturnInfo', returnDate: '2026-10-05T00:00:00.000Z',
        items: [
          { quantity: 1, lineItemId: 'l1', comment: 'Damaged', shipmentState: 'Advised' },
          { quantity: 2, lineItemId: 'l2', shipmentState: 'Advised' },
        ],
      },
    ]);
  });
});
