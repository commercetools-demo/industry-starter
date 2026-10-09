// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { makeRequest } from '@/test/request';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const read = { list: vi.fn(), one: vi.fn() };
vi.mock('@/lib/ct/orders-read', () => ({ listOrdersForCustomer: (...a: unknown[]) => read.list(...a), getOrderForCustomer: (...a: unknown[]) => read.one(...a) }));

import { GET as listRoute } from './route';
import { GET as oneRoute } from './[id]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const order = { id: 'o1', orderNumber: 'MLV-000001' };

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1', locale: 'en-US' });
  read.list.mockReset().mockResolvedValue([order]);
  read.one.mockReset().mockResolvedValue(order);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('order-history: GET /api/orders', () => {
  it('Own orders only: lists for the session customer, no-store', async () => {
    const response = await listRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ orders: [order] });
    expect(read.list).toHaveBeenCalledWith('c1', 'en-US');
  });

  it('401 without a session, before any read', async () => {
    getSession.mockResolvedValue({});
    await expectUnauthenticated(() => listRoute(), [read.list]);
  });

  it('never leaks an unexpected error', async () => {
    read.list.mockRejectedValue(Object.assign(new Error('secret-token'), { statusCode: 500 }));
    await expectSanitizedError(() => listRoute(), ['secret-token']);
  });
});

describe('order-history: GET /api/orders/:id', () => {
  it('returns the order, no-store', async () => {
    const response = await oneRoute(makeRequest('/api/orders/o1'), ctx('o1'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(order);
  });

  it('Detail of an order not theirs: a foreign id and an unknown id give the identical 404 body', async () => {
    read.one.mockResolvedValue(null);
    const foreign = await oneRoute(makeRequest('/api/orders/x'), ctx('foreign-id'));
    const unknown = await oneRoute(makeRequest('/api/orders/y'), ctx('unknown-id'));
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await foreign.json()).toEqual({ error: 'Order not found.' });
    expect(await unknown.json()).toEqual({ error: 'Order not found.' });
  });

  it('401 without a session, before any read', async () => {
    getSession.mockResolvedValue({});
    const response = await oneRoute(makeRequest('/api/orders/o1'), ctx('o1'));
    expect(response.status).toBe(401);
    expect(read.one).not.toHaveBeenCalled();
  });
});
