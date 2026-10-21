// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ listOrders: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/account-orders', () => ct);

import { GET } from '@/app/api/orders/route';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';
import { collectLine, ctOrder } from '@/test/orders';

const ctx = { params: Promise.resolve({}) };
const get = (qs = '') => GET(new Request(`http://x/api/orders${qs}`), ctx);

beforeEach(async () => {
  jar.store.clear();
  ct.listOrders.mockReset();
  ct.listOrders.mockResolvedValue({ results: [ctOrder({ lineItems: [collectLine('l1')], stateKey: 'ready-for-collection' })], total: 25 });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/orders', () => {
  it('401 without a session', async () => {
    expect((await get()).status).toBe(401);
  });

  it('Own orders only: a customerId in the query cannot override the session', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
    const res = await get('?customerId=c2&filter=ready&limit=5&offset=10');
    expect(res.status).toBe(200);
    expect(ct.listOrders).toHaveBeenCalledWith('c1', { filter: 'ready', limit: 5, offset: 10 });
    const body = await res.json();
    expect(body).toMatchObject({ total: 25, limit: 5, offset: 10 });
    expect(body.orders[0]).toMatchObject({ orderNumber: 'MC-1001', status: 'ready' });
    expect(JSON.stringify(body)).not.toContain('customerId');
  });

  it('defaults to the first page of ten', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
    await get();
    expect(ct.listOrders).toHaveBeenCalledWith('c1', { filter: 'all', limit: 10, offset: 0 });
  });

  it.each(['?filter=nope', '?limit=0', '?limit=51', '?limit=abc', '?offset=-1'])('refuses %s with 400', async (qs) => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
    expect((await get(qs)).status).toBe(400);
    expect(ct.listOrders).not.toHaveBeenCalled();
  });
});
