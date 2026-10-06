import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from '../mappers/__fixtures__/order.json';

const listCall = vi.fn();
const getCall = vi.fn();
const listExecute = vi.fn();
const getExecute = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({
    orders: () => ({
      get: (arg: unknown) => (listCall(arg), { execute: listExecute }),
      withId: (id: unknown) => ({ get: () => (getCall(id), { execute: getExecute }) }),
    }),
  }),
}));

import { getCustomerOrders, getOrderById, getOrderForCustomer } from './orders';

const order = (over: Record<string, unknown> = {}) => ({ ...(fixture as Record<string, unknown>), ...over });

beforeEach(() => {
  vi.clearAllMocks();
  listExecute.mockReset();
  getExecute.mockReset();
});

describe('getCustomerOrders', () => {
  it('queries by customer, newest first, with the page window, and maps list items', async () => {
    listExecute.mockResolvedValue({ body: { results: [order()], total: 11 } });
    const res = await getCustomerOrders('cust-1', { limit: 10, offset: 10, locale: 'en-US' });
    expect(listCall.mock.calls[0][0].queryArgs).toMatchObject({ where: 'customerId="cust-1"', sort: 'createdAt desc', limit: 10, offset: 10, withTotal: true });
    expect(res.total).toBe(11);
    expect(res.orders[0]).toMatchObject({ id: 'order-1', itemSummary: 'Bananas, Whole milk 1 L' });
  });

  it('strips quotes from the id before it reaches the predicate', async () => {
    listExecute.mockResolvedValue({ body: { results: [] } });
    const res = await getCustomerOrders('a"b', { limit: 10, offset: 0, locale: 'en-US' });
    expect(listCall.mock.calls[0][0].queryArgs.where).toBe('customerId="ab"');
    expect(res).toEqual({ orders: [], total: 0 });
  });
});

describe('getOrderById', () => {
  it('missing order (404) is null; other errors propagate', async () => {
    getExecute.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(await getOrderById('gone', 'en-US')).toBeNull();
    getExecute.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    await expect(getOrderById('x', 'en-US')).rejects.toThrow('boom');
  });
});

describe('getOrderForCustomer (ownership)', () => {
  it('own order is returned', async () => {
    getExecute.mockResolvedValue({ body: order() });
    expect((await getOrderForCustomer('order-1', 'cust-1', 'en-US'))?.id).toBe('order-1');
  });

  it("Another customer's order: null", async () => {
    getExecute.mockResolvedValue({ body: order() });
    expect(await getOrderForCustomer('order-1', 'cust-2', 'en-US')).toBeNull();
  });

  it("order without a customer (guest checkout) is not anyone's", async () => {
    getExecute.mockResolvedValue({ body: order({ customerId: undefined }) });
    expect(await getOrderForCustomer('order-1', 'cust-1', 'en-US')).toBeNull();
  });

  it('missing order: null', async () => {
    getExecute.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(await getOrderForCustomer('gone', 'cust-1', 'en-US')).toBeNull();
  });
});
