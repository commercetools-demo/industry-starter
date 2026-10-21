// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const cart = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: { carts: () => ({ withId: () => ({ get: () => ({ execute: cart.get }) }) }) },
}));

import { GET } from './route';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';

const call = () => GET(new Request('http://x/api/cart/count'), { params: Promise.resolve({}) });

beforeEach(() => {
  jar.store.clear();
  cart.get.mockReset();
});

describe('GET /api/cart/count', () => {
  it('returns 0 without a cart', async () => {
    const res = await call();
    expect(await res.json()).toEqual({ count: 0 });
    expect(cart.get).not.toHaveBeenCalled();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('sums quantities: 3 units across 2 lines is 3', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ cartId: 'c1' }));
    cart.get.mockResolvedValue({ body: { cartState: 'Active', totalLineItemQuantity: 3, lineItems: [{ quantity: 2 }, { quantity: 1 }] } });
    expect(await (await call()).json()).toEqual({ count: 3 });
  });

  it('falls back to summing the lines when the total is absent', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ cartId: 'c1' }));
    cart.get.mockResolvedValue({ body: { cartState: 'Active', lineItems: [{ quantity: 2 }, { quantity: 1 }] } });
    expect(await (await call()).json()).toEqual({ count: 3 });
  });

  it('returns 0 and clears a non-active cart', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ cartId: 'c1', customerId: 'u1' }));
    cart.get.mockResolvedValue({ body: { cartState: 'Ordered', totalLineItemQuantity: 4, lineItems: [] } });
    const res = await call();
    expect(await res.json()).toEqual({ count: 0 });
    const token = /malva-session=([^;]*)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
    const session = await verifySessionToken(token);
    expect(session.cartId).toBeUndefined();
    expect(session.customerId).toBe('u1');
  });

  it('a deleted cart (404) counts as 0 and is cleared', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ cartId: 'gone' }));
    cart.get.mockRejectedValue({ statusCode: 404 });
    const res = await call();
    expect(await res.json()).toEqual({ count: 0 });
    expect(res.headers.get('set-cookie')).toContain('malva-session=');
  });
});
