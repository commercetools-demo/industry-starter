// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ countOrders: vi.fn(), findList: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/account-orders', () => ({ countOrders: ct.countOrders }));
vi.mock('@/lib/ct/shopping-lists', () => ({ findList: ct.findList }));

import { GET } from '@/app/api/account/summary/route';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };

beforeEach(() => {
  jar.store.clear();
  ct.countOrders.mockReset();
  ct.findList.mockReset();
  ct.findList.mockResolvedValue({ lineItems: [{}, {}, {}, {}] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/account/summary', () => {
  it('Unauthenticated account call returns 401 with no detail', async () => {
    const res = await GET(new Request('http://x/api/account/summary'), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
  });

  it('counts the customer own orders only', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
    ct.countOrders.mockImplementation(async (_c: string, filter: string) => (filter === 'ready' ? 1 : 3));
    const res = await GET(new Request('http://x/api/account/summary'), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ openOrders: 3, readyForCollection: 1, savedItems: 4 });
    expect(ct.countOrders.mock.calls.every((c) => c[0] === 'c1')).toBe(true);
  });

  it('no list yet counts as zero saved items, and a failing list read is null', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
    ct.countOrders.mockResolvedValue(0);
    ct.findList.mockResolvedValueOnce(null);
    expect((await (await GET(new Request('http://x/api/account/summary'), ctx)).json()).savedItems).toBe(0);
    ct.findList.mockRejectedValueOnce(new Error('down'));
    expect((await (await GET(new Request('http://x/api/account/summary'), ctx)).json()).savedItems).toBeNull();
  });

  it('One backing service down: the failed count is null and the others stay', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
    ct.countOrders.mockImplementation(async (_c: string, filter: string) => {
      if (filter === 'in-progress') throw new Error('upstream down');
      return 2;
    });
    const res = await GET(new Request('http://x/api/account/summary'), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ openOrders: null, readyForCollection: 2 });
  });
});
