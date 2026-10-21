// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ getOrderByNumber: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/account-orders', () => ct);

import { GET } from '@/app/api/orders/number/[orderNumber]/route';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';
import { ctOrder } from '@/test/orders';

const call = (n: string) => GET(new Request(`http://x/api/orders/number/${n}`), { params: Promise.resolve({ orderNumber: n }) });

beforeEach(async () => {
  jar.store.clear();
  ct.getOrderByNumber.mockReset();
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1' }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/orders/number/[orderNumber]', () => {
  it('401 without a session, with no detail', async () => {
    jar.store.clear();
    const res = await call('MC-1001');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
  });

  it('returns the order with deliveries, returns and eligibility', async () => {
    ct.getOrderByNumber.mockResolvedValue(ctOrder({ shipmentState: 'Delivered' }));
    const res = await call('MC-1001');
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order).toMatchObject({ orderNumber: 'MC-1001', status: 'completed', deliveries: [], returns: [] });
    expect(ct.getOrderByNumber).toHaveBeenCalledWith('c1', 'MC-1001');
  });

  it('Detail of an order not theirs: unknown and foreign answer the identical 404', async () => {
    ct.getOrderByNumber.mockResolvedValue(null); // the ct module returns null for a foreign order
    const foreign = await call('MC-2002');
    const unknown = await call('MC-9999');
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await foreign.json()).toEqual(await unknown.json());
  });

  it('a malformed order number is the same 404 and makes no call', async () => {
    const res = await call('MC-1%20or%201');
    expect(res.status).toBe(404);
    expect(ct.getOrderByNumber).not.toHaveBeenCalled();
  });
});
