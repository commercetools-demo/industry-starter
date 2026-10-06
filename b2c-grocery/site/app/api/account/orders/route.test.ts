// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/ct/orders', () => ({ getCustomerOrders: vi.fn(), getOrderForCustomer: vi.fn() }));

import { GET } from './route';
import { GET as GET_ONE } from './[orderId]/route';
import { getCustomerOrders, getOrderForCustomer } from '@/lib/ct/orders';
import { getMarket, getSession } from '@/lib/session';

const call = (url = 'http://localhost/api/account/orders') => GET(new Request(url));
const callOne = (id: string) => GET_ONE(new Request(`http://localhost/api/account/orders/${id}`), { params: Promise.resolve({ orderId: id }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMarket).mockResolvedValue({ country: 'US', currency: 'USD', locale: 'en-US' });
});

describe('GET /api/account/orders', () => {
  it('Anonymous visitor: 401, private, nothing fetched', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(getCustomerOrders).not.toHaveBeenCalled();
  });

  it('returns the first page of the session customer, private, no-store', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getCustomerOrders).mockResolvedValue({ orders: [], total: 0 });
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ orders: [], total: 0, page: 1, pageSize: 10 });
    expect(getCustomerOrders).toHaveBeenCalledWith('cust-1', { limit: 10, offset: 0, locale: 'en-US' });
  });

  it('pagination: page 3 is offset 20; bad values fall back to page 1', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getCustomerOrders).mockResolvedValue({ orders: [], total: 25 });
    await call('http://localhost/api/account/orders?page=3');
    expect(getCustomerOrders).toHaveBeenLastCalledWith('cust-1', { limit: 10, offset: 20, locale: 'en-US' });
    for (const bad of ['0', '-2', 'x', '1.5', '']) {
      await call(`http://localhost/api/account/orders?page=${bad}`);
      expect(getCustomerOrders).toHaveBeenLastCalledWith('cust-1', { limit: 10, offset: 0, locale: 'en-US' });
    }
  });

  it('commercetools failure: private 500 without details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getCustomerOrders).mockRejectedValue(new Error('secret detail'));
    const res = await call();
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'ORDERS_ERROR' });
  });
});

describe('GET /api/account/orders/[orderId]', () => {
  it('Anonymous visitor: 401', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    const res = await callOne('o1');
    expect(res.status).toBe(401);
    expect(getOrderForCustomer).not.toHaveBeenCalled();
  });

  it('own order: 200 with the order, private, no-store', async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-1' });
    vi.mocked(getOrderForCustomer).mockResolvedValue({ id: 'o1' } as never);
    const res = await callOne('o1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ order: { id: 'o1' } });
    expect(getOrderForCustomer).toHaveBeenCalledWith('o1', 'cust-1', 'en-US');
  });

  it("Another customer's order: 404", async () => {
    vi.mocked(getSession).mockResolvedValue({ customerId: 'cust-2' });
    vi.mocked(getOrderForCustomer).mockResolvedValue(null);
    const res = await callOne('o1');
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'ORDER_NOT_FOUND' });
  });
});
