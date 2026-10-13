// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/ct/in-store', () => ({
  inStore: (storeKey: string) => ({
    orders: () => ({
      get: (arg: unknown) => ({ execute: async () => ({ body: await h.list(storeKey, arg) }) }),
      withOrderNumber: ({ orderNumber }: { orderNumber: string }) => ({
        get: () => ({ execute: async () => ({ body: await h.get(storeKey, orderNumber) }) }),
        post: (arg: unknown) => ({ execute: async () => ({ body: await h.post(storeKey, orderNumber, arg) }) }),
      }),
    }),
  }),
}));

import { getAccountOrder, listOrders, listReturns, requestReturn } from './account-orders';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-12T10:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  version: 7,
  orderNumber: 'MA-ABCD2345',
  customerId: CUSTOMER,
  createdAt: ago(10),
  lastModifiedAt: ago(1),
  shipmentState: 'Delivered',
  custom: { fields: { deliveredAt: ago(3) } },
  totalPrice: { centAmount: 1000, currencyCode: 'EUR', fractionDigits: 2, type: 'centPrecision' },
  lineItems: [{ id: 'l1', name: { 'en-US': 'Pads' }, quantity: 4 }],
  returnInfo: [],
  ...over,
});
const posted = () => (h.post.mock.calls.at(-1) as [string, string, { body: { version: number; actions: Array<Record<string, unknown>> } }])[2].body;

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ results: [order()], total: 1 });
  h.get.mockReset().mockResolvedValue(order());
  h.post.mockReset().mockResolvedValue(order());
});

describe('orders', () => {
  it('list is scoped by customer and store, newest first', async () => {
    const page = await listOrders('mau-reseller-north', CUSTOMER, { page: 2 });
    const [storeKey, arg] = h.list.mock.calls[0] as [string, { queryArgs: Record<string, unknown> }];
    expect(storeKey).toBe('mau-reseller-north');
    expect(arg.queryArgs.where).toBe(`customerId="${CUSTOMER}"`);
    expect(arg.queryArgs.sort).toBe('createdAt desc');
    expect(arg.queryArgs).toMatchObject({ limit: 10, offset: 10, withTotal: true });
    expect(page).toMatchObject({ page: 2, pageSize: 10, total: 1 });
  });
  it('predicate rejects a malformed id', async () => {
    await expect(listOrders('s1', 'x" or customerId is defined or "')).rejects.toMatchObject({ status: 404 });
    expect(h.list).not.toHaveBeenCalled();
  });
  it('detail of another customer is null', async () => {
    h.get.mockResolvedValue(order({ customerId: 'someone-else' }));
    await expect(getAccountOrder('s1', CUSTOMER, 'MA-ABCD2345')).resolves.toBeNull();
  });
  it('a malformed order number is null without a read', async () => {
    await expect(getAccountOrder('s1', CUSTOMER, 'nope')).resolves.toBeNull();
    expect(h.get).not.toHaveBeenCalled();
  });
  it('a 404 is null', async () => {
    h.get.mockRejectedValue({ statusCode: 404 });
    await expect(getAccountOrder('s1', CUSTOMER, 'MA-ABCD2345')).resolves.toBeNull();
  });
});

describe('returns', () => {
  const input = { items: [{ lineItemId: 'l1', quantity: 1 }], reason: 'wrong-fit' };
  const run = (over: Partial<typeof input> & { comment?: string } = {}, options = {}) => requestReturn('s1', CUSTOMER, 'MA-ABCD2345', { ...input, ...over }, { now: NOW, ...options });

  it('return of one line records reason and quantity', async () => {
    const result = await run();
    const action = posted().actions[0] as { items: Array<{ quantity: number; custom: { fields: Record<string, string> } }>; returnTrackingId: string };
    expect(posted().version).toBe(7);
    expect(action.items[0].quantity).toBe(1);
    expect(action.items[0].custom.fields).toMatchObject({ reason: 'wrong-fit', status: 'requested' });
    expect(result.tracking).toBe(action.returnTrackingId);
    expect(result.returnNumber).toBe('RET-MA-ABCD2345-1');
  });
  it('outside the window is refused', async () => {
    h.get.mockResolvedValue(order({ custom: { fields: { deliveredAt: ago(31) } } }));
    await expect(run()).rejects.toMatchObject({ code: 'RETURN_WINDOW_CLOSED', status: 409 });
    expect(h.post).not.toHaveBeenCalled();
  });
  it('day 30 is allowed', async () => {
    h.get.mockResolvedValue(order({ custom: { fields: { deliveredAt: ago(30) } } }));
    await expect(run()).resolves.toBeDefined();
  });
  it('not delivered is refused', async () => {
    h.get.mockResolvedValue(order({ shipmentState: 'Shipped', custom: undefined }));
    await expect(run()).rejects.toMatchObject({ code: 'NOT_DELIVERED' });
  });
  it('window reads store-settings returnWindowDays', async () => {
    h.get.mockResolvedValue(order({ custom: { fields: { deliveredAt: ago(20) } } }));
    await expect(run({}, { windowDays: 14 })).rejects.toMatchObject({ code: 'RETURN_WINDOW_CLOSED' });
  });
  it('quantity above remaining is refused', async () => {
    await expect(run({ items: [{ lineItemId: 'l1', quantity: 5 }] })).rejects.toMatchObject({ code: 'quantity-exceeds' });
    h.get.mockResolvedValue(order({ returnInfo: [{ items: [{ lineItemId: 'l1', quantity: 3 }] }] }));
    await expect(run({ items: [{ lineItemId: 'l1', quantity: 2 }] })).rejects.toMatchObject({ code: 'quantity-exceeds' });
  });
  it('second identical request for the full quantity is refused', async () => {
    h.get.mockResolvedValue(order({ returnInfo: [{ items: [{ lineItemId: 'l1', quantity: 4 }] }] }));
    await expect(run({ items: [{ lineItemId: 'l1', quantity: 4 }] })).rejects.toMatchObject({ code: 'NOTHING_LEFT' });
  });
  it("other customer's order is refused", async () => {
    h.get.mockResolvedValue(order({ customerId: 'someone-else' }));
    await expect(run()).rejects.toMatchObject({ status: 404 });
  });
  it('unknown line, empty selection and unknown reason are refused', async () => {
    await expect(run({ items: [{ lineItemId: 'zz', quantity: 1 }] })).rejects.toMatchObject({ code: 'invalid-line' });
    await expect(run({ items: [] })).rejects.toMatchObject({ code: 'no-items' });
    await expect(run({ reason: 'because' })).rejects.toMatchObject({ code: 'invalid-reason' });
  });
  it('a version conflict re-reads and tries once more', async () => {
    h.post.mockRejectedValueOnce({ statusCode: 409 }).mockResolvedValueOnce(order());
    await run();
    expect(h.post).toHaveBeenCalledTimes(2);
    expect(h.get).toHaveBeenCalledTimes(2);
  });
  it('the order fields the portal reads from the shopper side stay untouched (only addReturnInfo is sent)', async () => {
    await run();
    expect(posted().actions.map((a) => a.action)).toEqual(['addReturnInfo']);
  });
  it('listReturns flattens the returns of the customer orders', async () => {
    h.list.mockResolvedValue({
      results: [order({ returnInfo: [{ returnTrackingId: 'RT-1', returnDate: ago(2), items: [{ lineItemId: 'l1', quantity: 1, shipmentState: 'Advised', custom: { fields: { returnNumber: 'RET-MA-ABCD2345-1', status: 'requested', reason: 'wrong-fit' } } }] }] })],
    });
    const list = await listReturns('s1', CUSTOMER, 'en-US');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ returnNumber: 'RET-MA-ABCD2345-1', orderNumber: 'MA-ABCD2345', status: 'requested' });
  });
});
