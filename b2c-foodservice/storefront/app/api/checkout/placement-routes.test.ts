// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  view: vi.fn(),
  payCart: vi.fn(),
  byNumber: vi.fn(),
  create: vi.fn(),
  poll: vi.fn(),
  removePaid: vi.fn(),
  ready: true,
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/cart', () => ({ getCartView: h.view }));
vi.mock('@/lib/ct/orders', () => ({ getOrderByNumber: h.byNumber }));
vi.mock('@/lib/ct/checkout-session', () => ({ createCheckoutSession: h.create }));
vi.mock('@/lib/checkout/finalize', () => ({ finalizeWithPolling: h.poll }));
vi.mock('@/lib/ct/checkout', async () => {
  const { checkoutBlockers } = await import('@/lib/checkout/guards');
  return {
    getPaymentCart: h.payCart,
    isCollectReady: () => h.ready,
    totalCentsOf: (c: { total: number }) => c.total,
    firstBlocker: (cart: Parameters<typeof checkoutBlockers>[0], s: { customerId?: string }) => checkoutBlockers(cart, s)[0] ?? null,
    removePaidLines: h.removePaid,
  };
});

import { POST as complete } from './complete/route';
import { POST as session } from './session/route';
import { GET as returnRoute } from '@/app/checkout/return/route';
import { orderNumberForCart } from '@/lib/checkout/order-number';
import { PAY_CARTS_COOKIE } from '@/lib/checkout/pay-cookie';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';
import { STORE_SOHO, viewCart, viewLine } from '@/test/cart';

const ctx = { params: Promise.resolve({}) };
const setSession = async (s: Record<string, string>) => h.jar.set(SESSION_COOKIE, await createSessionToken(s));
const post = (route: typeof session, body: unknown) => route(new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }), ctx);
const errOf = async (res: Response) => ((await res.json()) as { error: Record<string, unknown> }).error;
const cookieOf = (res: Response, name: string) => res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const NUMBER = orderNumberForCart('cart-1');
const orderView = (over: Record<string, unknown> = {}) => ({ id: 'ord-1', orderNumber: NUMBER, locale: 'en-US', email: 'guest@example.com', customerId: null, ...over });

beforeEach(async () => {
  h.jar.clear();
  for (const f of [h.view, h.payCart, h.byNumber, h.create, h.poll, h.removePaid]) f.mockReset();
  h.ready = true;
  await setSession({ anonymousId: 'anon', cartId: 'cart-1', country: 'US', currency: 'USD', locale: 'en-US' });
  h.view.mockResolvedValue({ cart: viewCart([viewLine({ id: 's1' })]), session: {} });
  h.payCart.mockResolvedValue({ id: 'cart-1', total: 1815, lineItems: [{}] });
  h.byNumber.mockResolvedValue(null);
  h.create.mockResolvedValue({ id: 'sess-1', projectKey: 'spec-test-b2c-food', region: 'us-central1.gcp', expiresAt: null });
});

describe('POST /api/checkout/session', () => {
  it('creates a session for the session cart with the deterministic order number', async () => {
    const res = await post(session, { expectedTotalCents: 1815, cartId: 'evil' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sessionId: 'sess-1', orderNumber: NUMBER, projectKey: 'spec-test-b2c-food' });
    expect(h.create).toHaveBeenCalledWith({ cartId: 'cart-1', orderNumber: NUMBER });
  });
  it('Session is refused when the total moved', async () => {
    const res = await post(session, { expectedTotalCents: 1000 });
    expect(res.status).toBe(409);
    expect((await errOf(res)).code).toBe('totals_changed');
    expect(h.create).not.toHaveBeenCalled();
  });
  it('Session is refused when the pickup is missing', async () => {
    h.view.mockResolvedValue({ cart: viewCart([viewLine({ id: 'c1', fulfilment: 'collect', store: STORE_SOHO })]), session: {} });
    h.ready = false;
    const res = await post(session, { expectedTotalCents: 1815 });
    expect(res.status).toBe(409);
    const e = await errOf(res);
    expect(e.code).toBe('checkout_not_ready');
    expect(e.missing).toEqual(['pickup']);
  });
  it('Existing order is reported instead of a second session', async () => {
    h.byNumber.mockResolvedValue({ id: 'ord-9' });
    const res = await post(session, { expectedTotalCents: 1815 });
    expect(res.status).toBe(409);
    expect(await errOf(res)).toMatchObject({ code: 'order_exists', orderId: 'ord-9' });
    expect(h.create).not.toHaveBeenCalled();
  });
  it('needs a bag and a number', async () => {
    h.jar.clear();
    expect((await post(session, { expectedTotalCents: 1 })).status).toBe(404);
    await setSession({ anonymousId: 'anon', cartId: 'cart-1' });
    expect((await post(session, {})).status).toBe(400);
  });
  it('a payment part pays its clone cart with a suffixed number', async () => {
    h.jar.set(PAY_CARTS_COOKIE, JSON.stringify([{ id: 'clone-a', clusterKey: 'collect:mcf-store-nyc-soho', label: 'SoHo', totalCents: 1000 }, { id: 'clone-b', clusterKey: 'delivery', label: null, totalCents: 1815 }]));
    h.payCart.mockResolvedValue({ id: 'clone-b', total: 1815, lineItems: [{}] });
    const res = await post(session, { expectedTotalCents: 1815, part: 1 });
    expect(res.status).toBe(200);
    expect(h.create).toHaveBeenCalledWith({ cartId: 'clone-b', orderNumber: `${NUMBER}-B` });
    expect((await post(session, { expectedTotalCents: 1, part: 2 })).status).toBe(400);
  });
  it('a sign-in rule answers 401', async () => {
    const { EXTRA_BLOCKERS } = await import('@/lib/checkout/guards');
    EXTRA_BLOCKERS.push(() => ({ code: 'sign_in_required' }));
    try {
      expect((await post(session, { expectedTotalCents: 1815 })).status).toBe(401);
    } finally {
      EXTRA_BLOCKERS.pop();
    }
  });
});

describe('POST /api/checkout/complete', () => {
  it('Finalize clears the cart id and sets the guest email cookie (HttpOnly, one hour)', async () => {
    h.poll.mockResolvedValue(orderView());
    const res = await post(complete, {});
    expect(await res.json()).toEqual({ orderId: 'ord-1', next: null });
    const sessionCookie = cookieOf(res, SESSION_COOKIE) ?? '';
    const next = await verifySessionToken(sessionCookie.split(';')[0]?.slice(SESSION_COOKIE.length + 1));
    expect(next.cartId).toBeUndefined();
    expect(next.anonymousId).toBe('anon');
    const guest = cookieOf(res, 'mcf_guest_email') ?? '';
    expect(guest.toLowerCase()).toContain('httponly');
    expect(guest).toContain('Max-Age=3600');
    expect(h.poll).toHaveBeenCalledWith({ orderNumber: NUMBER });
  });
  it('a member order sets no guest cookie', async () => {
    await setSession({ customerId: 'cust-1', cartId: 'cart-1' });
    h.poll.mockResolvedValue(orderView({ customerId: 'cust-1' }));
    expect(cookieOf(await post(complete, {}), 'mcf_guest_email')).toBeUndefined();
  });
  it('Placement outcome unknown: no order yet answers 404 order_not_found and keeps the bag', async () => {
    h.poll.mockResolvedValue(null);
    const res = await post(complete, {});
    expect(res.status).toBe(404);
    expect((await errOf(res)).code).toBe('order_not_found');
    expect(cookieOf(res, SESSION_COOKIE)).toBeUndefined();
  });
  it('the first of two payments keeps the bag, removes its lines and names the next payment', async () => {
    h.jar.set(PAY_CARTS_COOKIE, JSON.stringify([{ id: 'clone-a', clusterKey: 'collect:mcf-store-nyc-soho', label: 'SoHo', totalCents: 1000 }, { id: 'clone-b', clusterKey: 'delivery', label: null, totalCents: 1815 }]));
    h.poll.mockResolvedValue(orderView({ orderNumber: `${NUMBER}-A` }));
    const res = await post(complete, { part: 0 });
    expect(await res.json()).toEqual({ orderId: 'ord-1', next: 1 });
    expect(h.removePaid).toHaveBeenCalledWith(expect.objectContaining({ cartId: 'cart-1' }), 'clone-a');
    expect(cookieOf(res, SESSION_COOKIE)).toBeUndefined();
    expect(h.poll).toHaveBeenCalledWith({ orderNumber: `${NUMBER}-A` });
  });
  it('the last of two payments also removes its lines from the old bag, so nothing paid comes back at the next sign-in', async () => {
    h.jar.set(PAY_CARTS_COOKIE, JSON.stringify([{ id: 'clone-a', clusterKey: 'collect:mcf-store-nyc-soho', label: 'SoHo', totalCents: 1000 }, { id: 'clone-b', clusterKey: 'delivery', label: null, totalCents: 1815 }]));
    h.poll.mockResolvedValue(orderView({ orderNumber: `${NUMBER}-B` }));
    const res = await post(complete, { part: 1 });
    expect(await res.json()).toEqual({ orderId: 'ord-1', next: null });
    expect(h.removePaid).toHaveBeenCalledWith(expect.objectContaining({ cartId: 'cart-1' }), 'clone-b');
    const sessionCookie = cookieOf(res, SESSION_COOKIE) ?? '';
    expect((await verifySessionToken(sessionCookie.split(';')[0]?.slice(SESSION_COOKIE.length + 1))).cartId).toBeUndefined();
  });
  it('a bag paid in one piece removes nothing (the hosted flow orders the cart itself)', async () => {
    h.poll.mockResolvedValue(orderView());
    await post(complete, {});
    expect(h.removePaid).not.toHaveBeenCalled();
  });
  it('an order that is not this bag changes nothing', async () => {
    h.poll.mockResolvedValue(orderView({ orderNumber: 'MC-ZZZZZZZZZZ' }));
    expect(cookieOf(await post(complete, {}), SESSION_COOKIE)).toBeUndefined();
  });
});

describe('GET /checkout/return', () => {
  const get = (qs: string) => returnRoute(new Request(`http://localhost:3000/checkout/return${qs}`), ctx);
  it('Return route redirects to the order locale', async () => {
    h.poll.mockResolvedValue(orderView({ locale: 'en-CA' }));
    const res = await get('?orderId=ord-1');
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-CA/checkout/confirmation/ord-1');
  });
  it('Return route ignores a locale in the query', async () => {
    h.poll.mockResolvedValue(orderView({ locale: 'en-US' }));
    const res = await get('?orderId=ord-1&locale=en-CA&redirect=https://evil.example');
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-US/checkout/confirmation/ord-1');
    expect(new URL(res.headers.get('location') ?? '').host).toBe('localhost:3000');
  });
  it('an order locale that is not ours falls back to the default locale', async () => {
    h.poll.mockResolvedValue(orderView({ locale: 'de-DE' }));
    expect(new URL((await get('?orderId=ord-1')).headers.get('location') ?? '').pathname).toBe('/en-US/checkout/confirmation/ord-1');
  });
  it('Return route with unknown order lands on No recent order', async () => {
    h.poll.mockResolvedValue(null);
    for (const qs of ['?orderId=nope', '', '?orderId=a/../b&orderNumber=%22x']) {
      const res = await get(qs);
      expect(res.status).toBe(303);
      expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/en-US/checkout/confirmation');
    }
  });
  it('finalises by order number too, and a redirect payment of this bag empties it', async () => {
    h.poll.mockResolvedValue(orderView());
    const res = await get(`?orderNumber=${NUMBER}`);
    expect(h.poll).toHaveBeenCalledWith({ orderNumber: NUMBER });
    expect(cookieOf(res, SESSION_COOKIE)).toBeDefined();
  });
  it('a return for the first of two payments goes back to the next payment', async () => {
    h.jar.set(PAY_CARTS_COOKIE, JSON.stringify([{ id: 'clone-a', clusterKey: 'collect:mcf-store-nyc-soho', label: 'SoHo', totalCents: 1000 }, { id: 'clone-b', clusterKey: 'delivery', label: null, totalCents: 1815 }]));
    h.poll.mockResolvedValue(orderView({ orderNumber: `${NUMBER}-A` }));
    const loc = new URL((await get('?orderId=ord-1')).headers.get('location') ?? '');
    expect(loc.pathname + loc.search).toBe('/en-US/checkout?resume=1&part=1');
  });
});
