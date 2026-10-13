// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE, sessionCookieOptions, verifySession } from '@/lib/session-core';
import type { Session } from '@/lib/types';
import { ctCart, lineItem } from '@/test/cart-fixtures';
import { makeRequest } from '@/test/request';

const state = vi.hoisted(() => ({ session: {} as Session }));
const loginPost = vi.hoisted(() => vi.fn());
const cartGet = vi.hoisted(() => vi.fn());
const cartPost = vi.hoisted(() => vi.fn());
const customerGet = vi.hoisted(() => vi.fn());
const runHooks = vi.hoisted(() => vi.fn());

vi.mock('@/lib/session', () => ({
  getSession: async () => state.session,
  updateSession: async (patch: (s: Session) => Session) => (state.session = patch(state.session)),
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    inStoreKeyWithStoreKeyValue: () => ({
      login: () => ({ post: (args: unknown) => ({ execute: () => loginPost(args) }) }),
      carts: () => ({ withId: () => ({ get: () => ({ execute: cartGet }), post: (args: unknown) => ({ execute: () => cartPost(args) }) }) }),
      customers: () => ({ withId: () => ({ get: () => ({ execute: customerGet }) }) }),
    }),
  },
  projectKey: 'p',
}));
vi.mock('@/lib/auth', () => ({ runSignInHooks: runHooks }));

const customer = { id: 'cust-1', email: 'anna@example.com', firstName: 'Anna', lastName: 'Schneider', version: 1, addresses: [{ id: 'a1', country: 'DE', city: 'Berlin' }], defaultShippingAddressId: 'a1', password: 'never-shown' };
const merged = ctCart({ lineItems: [lineItem('li-1', 'BRK-1', 2, { list: 5000 }), lineItem('li-2', 'FLT-1', 1, { list: 1000 })] });
const post = (body: unknown, headers: Record<string, string> = {}) => makeRequest('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const good = { email: 'anna@example.com', password: 'pw' };

beforeEach(() => {
  vi.resetModules();
  for (const m of [loginPost, cartGet, cartPost, customerGet, runHooks]) m.mockReset();
  state.session = { storeKey: 'mau-reseller-north', cartId: 'anon-cart', anonymousId: 'anon-1' };
  loginPost.mockResolvedValue({ body: { customer, cart: merged } });
  cartGet.mockResolvedValue({ body: merged });
  cartPost.mockResolvedValue({ body: merged });
});

describe('POST /api/auth/login', () => {
  it('sets session customerId and cartId from merged cart', async () => {
    const { POST } = await import('./login/route');
    const res = await POST(post(good));
    expect(res.status).toBe(200);
    expect(state.session).toMatchObject({ customerId: 'cust-1', cartId: 'cart-1', anonymousId: 'anon-1', storeKey: 'mau-reseller-north' });
    const body = await res.json();
    expect(body.count).toBe(3);
    expect(body.customer).toMatchObject({ id: 'cust-1', email: 'anna@example.com', firstName: 'Anna' });
    expect(JSON.stringify(body)).not.toContain('never-shown');
    expect(loginPost.mock.calls[0][0].body).toMatchObject({ anonymousCart: { id: 'anon-cart' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' });
  });
  it('runs the sign-in hooks after the merge with the customer id', async () => {
    const { POST } = await import('./login/route');
    await POST(post(good));
    expect(runHooks).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-1' }));
  });
  it('a customer without a cart keeps no cart id', async () => {
    loginPost.mockResolvedValue({ body: { customer } });
    const { POST } = await import('./login/route');
    await POST(post(good));
    expect(state.session.cartId).toBeUndefined();
    expect(state.session.customerId).toBe('cust-1');
  });
  it('400 on bad body', async () => {
    const { POST } = await import('./login/route');
    expect((await POST(post({ email: 'not-an-email', password: 'pw' }))).status).toBe(400);
    expect((await POST(post({ email: 'a@example.com' }))).status).toBe(400);
    expect(loginPost).not.toHaveBeenCalled();
  });
  it('wrong password and a customer of another store answer the same 401', async () => {
    loginPost.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'InvalidCredentials' }] } });
    const { POST } = await import('./login/route');
    const wrong = await POST(post({ ...good, password: 'bad' }, { 'x-forwarded-for': '10.0.0.1' }));
    const other = await POST(post(good, { 'x-forwarded-for': '10.0.0.2' }));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: 'invalid-credentials' });
    expect(await other.json()).toEqual({ error: 'invalid-credentials' });
    expect(state.session.customerId).toBeUndefined();
    expect(runHooks).not.toHaveBeenCalled();
  });
  it('429 after limit', async () => {
    const { POST } = await import('./login/route');
    for (let i = 0; i < 10; i += 1) await POST(post(good, { 'x-forwarded-for': '10.9.9.9' }));
    const res = await POST(post(good, { 'x-forwarded-for': '10.9.9.9' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
    expect((await POST(post(good, { 'x-forwarded-for': '10.9.9.8' }))).status).toBe(200);
  });
  it('404 without a store in the session', async () => {
    state.session = {};
    const { POST } = await import('./login/route');
    expect((await POST(post(good))).status).toBe(404);
  });
  it('an outage is a 500 that leaks nothing', async () => {
    loginPost.mockRejectedValue({ statusCode: 503, message: 'secret-detail' });
    const { POST } = await import('./login/route');
    const res = await POST(post(good));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secret-detail');
  });
  it('cookie is HttpOnly lax', async () => {
    const options = sessionCookieOptions();
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    expect(SESSION_COOKIE).toBe('malva_session');
    expect(await verifySession(undefined, new Uint8Array(32))).toEqual({});
  });
});

describe('POST /api/auth/logout', () => {
  it('drops customer and cart and rotates the anonymous id', async () => {
    state.session = { storeKey: 'mau-reseller-north', customerId: 'cust-1', cartId: 'cart-1', anonymousId: 'anon-1' };
    const { POST } = await import('./logout/route');
    const res = await POST();
    expect(await res.json()).toEqual({ ok: true });
    expect(state.session.customerId).toBeUndefined();
    expect(state.session.cartId).toBeUndefined();
    expect(state.session.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
    expect(state.session.anonymousId).not.toBe('anon-1');
    expect(state.session.storeKey).toBe('mau-reseller-north');
  });
  it('signing out of a shop-as session also drops the impersonation fields (V-06)', async () => {
    state.session = { storeKey: 'mau-reseller-north', customerId: 'cust-1', anonymousId: 'anon-1', impersonatedBy: 'seller-1', impJti: 'j', impImpExp: 5, impAbs: 9 };
    const { POST } = await import('./logout/route');
    await POST();
    expect(state.session).not.toHaveProperty('impersonatedBy');
    expect(state.session).not.toHaveProperty('impJti');
    expect(state.session).not.toHaveProperty('impAbs');
  });
});

describe('sign in during a shop-as session (V-06)', () => {
  it('a sign-in ends the impersonation: the actor is never attached to another customer', async () => {
    state.session = { storeKey: 'mau-reseller-north', customerId: 'cust-9', anonymousId: 'anon-1', impersonatedBy: 'seller-1', impJti: 'j', impImpExp: 5, impAbs: 9 };
    const { POST } = await import('./login/route');
    const res = await POST(post(good));
    expect(res.status).toBe(200);
    expect(state.session).toMatchObject({ customerId: 'cust-1' });
    expect(state.session).not.toHaveProperty('impersonatedBy');
    expect(state.session).not.toHaveProperty('impImpExp');
  });
});

describe('GET /api/auth/me', () => {
  it('null when signed out', async () => {
    const { GET } = await import('./me/route');
    expect(await (await GET()).json()).toEqual({ customer: null });
    expect(customerGet).not.toHaveBeenCalled();
  });
  it('the customer when signed in', async () => {
    state.session = { storeKey: 'mau-reseller-north', customerId: 'cust-1' };
    customerGet.mockResolvedValue({ body: customer });
    const { GET } = await import('./me/route');
    const body = await (await GET()).json();
    expect(body.customer).toMatchObject({ id: 'cust-1', lastName: 'Schneider', defaultShippingAddressId: 'a1' });
    expect(body.customer.addresses).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('never-shown');
  });
  it('shopping as the customer shows the names but a masked e-mail, no phone and no addresses (V-06)', async () => {
    state.session = { storeKey: 'mau-reseller-north', customerId: 'cust-1', impersonatedBy: 'seller-1' };
    customerGet.mockResolvedValue({ body: customer });
    const { GET } = await import('./me/route');
    const body = await (await GET()).json();
    expect(body.customer).toMatchObject({ id: 'cust-1', firstName: 'Anna', lastName: 'Schneider', email: 'a***@e***.com', mobile: null, addresses: [] });
    expect(JSON.stringify(body)).not.toContain('anna@example.com');
  });
  it('a customer of another store is signed out', async () => {
    state.session = { storeKey: 'mau-reseller-south', customerId: 'cust-1' };
    customerGet.mockRejectedValue({ statusCode: 404 });
    const { GET } = await import('./me/route');
    expect(await (await GET()).json()).toEqual({ customer: null });
    expect(state.session.customerId).toBeUndefined();
  });
});
