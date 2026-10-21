// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  read: vi.fn(),
  prepare: vi.fn(),
  seenSessions: [] as unknown[],
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/checkout', async () => {
  const { checkoutBlockers } = await import('@/lib/checkout/guards');
  class CheckoutNotReady extends Error {
    constructor(readonly missing: string[]) {
      super('checkout_not_ready');
    }
  }
  return {
    getCheckoutState: h.read,
    preparePayments: h.prepare,
    CheckoutNotReady,
    firstBlocker: (cart: Parameters<typeof checkoutBlockers>[0], s: { customerId?: string }) => checkoutBlockers(cart, s)[0] ?? null,
  };
});

import { GET } from './route';
import { PUT } from './pickup/route';
import { buildSummary, checkoutIssues } from '@/lib/checkout/summary';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';
import type { Cart, CheckoutState } from '@/lib/types';
import { STORE_SOHO, viewCart, viewLine } from '@/test/cart';

const ctx = { params: Promise.resolve({}) };
const setSession = async (s: Record<string, string>) => h.jar.set(SESSION_COOKIE, await createSessionToken(s));

function stateOf(cart: Cart): CheckoutState {
  return {
    cartId: cart.id, version: cart.version, strategy: 'complete-per-group', cart, pickup: null, deliveryNote: null, codes: [],
    summary: buildSummary(cart), issues: checkoutIssues(cart), payments: null,
  };
}
const mixed = () => viewCart([viewLine({ id: 'c1', fulfilment: 'collect', store: STORE_SOHO }), viewLine({ id: 's1' })]);
const put = (body: unknown) => PUT(new Request('http://x/api/checkout/pickup', { method: 'PUT', body: JSON.stringify(body) }), ctx);
const errOf = async (res: Response) => ((await res.json()) as { error: Record<string, unknown> }).error;

beforeEach(async () => {
  h.jar.clear();
  h.read.mockReset();
  h.prepare.mockReset();
  await setSession({ anonymousId: 'anon', cartId: 'cart-1', country: 'US', currency: 'USD', locale: 'en-US' });
});

describe('GET /api/checkout', () => {
  it('State returns every line with its group key', async () => {
    const cart = mixed();
    h.read.mockResolvedValue({ state: stateOf(cart), session: { cartId: 'cart-1' } });
    const res = await GET(new Request('http://x/api/checkout'), ctx);
    const body = (await res.json()) as CheckoutState;
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.cart.lines.map((l) => [l.id, l.groupKey])).toEqual([['c1', 'collect:mcf-store-nyc-soho'], ['s1', 'delivery']]);
  });
  it('Unauthenticated guest can check out', async () => {
    h.read.mockResolvedValue({ state: stateOf(mixed()), session: { cartId: 'cart-1' } });
    expect((await GET(new Request('http://x/api/checkout'), ctx)).status).toBe(200);
  });
  it('Two shoppers get only their own cart', async () => {
    h.read.mockResolvedValue({ state: stateOf(mixed()), session: { cartId: 'cart-1' } });
    await GET(new Request('http://x/api/checkout?cartId=other'), ctx);
    expect(h.read.mock.calls[0]?.[0]).toMatchObject({ cartId: 'cart-1', anonymousId: 'anon' });
    await setSession({ anonymousId: 'someone-else', cartId: 'cart-2' });
    await GET(new Request('http://x/api/checkout'), ctx);
    expect(h.read.mock.calls[1]?.[0]).toMatchObject({ cartId: 'cart-2', anonymousId: 'someone-else' });
  });
  it('answers 404 without a bag and 409 for an empty one', async () => {
    h.read.mockResolvedValue({ state: null, session: {} });
    expect((await GET(new Request('http://x/api/checkout'), ctx)).status).toBe(404);
    h.read.mockResolvedValue({ state: stateOf(viewCart([])), session: { cartId: 'cart-1' } });
    const res = await GET(new Request('http://x/api/checkout'), ctx);
    expect(res.status).toBe(409);
    expect((await errOf(res)).code).toBe('cart_empty');
  });
  it('Handlers return no commercetools body on 5xx', async () => {
    h.read.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 503, body: { errors: [{ code: 'secret', message: 'internal detail' }] } }));
    const res = await GET(new Request('http://x/api/checkout'), ctx);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|internal detail/);
  });
});

describe('PUT /api/checkout/pickup', () => {
  it('Pickup is required when something is collected', async () => {
    h.read.mockResolvedValue({ state: stateOf(mixed()), session: { cartId: 'cart-1' } });
    const res = await put({ person: 'me', pickupName: '' });
    expect(res.status).toBe(422);
    const error = await errOf(res);
    expect(error.code).toBe('validation_failed');
    expect(error.fields).toEqual({ pickupName: 'pickup_name_required' });
    expect(h.prepare).not.toHaveBeenCalled();
  });
  it('Validation failures return field codes', async () => {
    h.read.mockResolvedValue({ state: stateOf(mixed()), session: { cartId: 'cart-1' } });
    const error = await errOf(await put({ person: 'them', pickupName: '<b>x</b>' }));
    expect(error.fields).toEqual({ person: 'person_invalid', pickupName: 'pickup_name_invalid' });
  });
  it('Pickup is ignored in a Canada session', async () => {
    const cart = viewCart([viewLine({ id: 's1' })], { country: 'CA', currency: 'CAD' });
    h.read.mockResolvedValue({ state: stateOf(cart), session: { cartId: 'cart-1' } });
    h.prepare.mockResolvedValue({ payments: [{ part: 0, clusterKey: 'delivery', label: null, totalCents: 1815 }], payCartIds: [] });
    const res = await put({});
    expect(res.status).toBe(200);
    expect(h.prepare.mock.calls[0]?.[2]).toMatchObject({ pickupName: null });
  });
  it('Cart id in the body is ignored', async () => {
    h.read.mockResolvedValue({ state: stateOf(mixed()), session: { cartId: 'cart-1' } });
    h.prepare.mockResolvedValue({ payments: [], payCartIds: [] });
    await put({ person: 'me', pickupName: 'Maya Lopez', cartId: 'evil-cart', customerId: 'evil' });
    expect(h.prepare.mock.calls[0]?.[0]).toMatchObject({ cartId: 'cart-1' });
    expect(JSON.stringify(h.prepare.mock.calls[0])).not.toContain('evil');
  });
  it('Collect out of stock returns 409', async () => {
    const cart = viewCart([viewLine({ id: 'c1', fulfilment: 'collect', store: STORE_SOHO, notices: [{ kind: 'collect-unavailable' }] })]);
    h.read.mockResolvedValue({ state: stateOf(cart), session: { cartId: 'cart-1' } });
    const res = await put({ person: 'me', pickupName: 'Maya Lopez' });
    expect(res.status).toBe(409);
    expect((await errOf(res)).code).toBe('collect_out_of_stock');
  });
  it('Collect only: the pay stage is prepared and the clone cart ids go into an HTTP-only cookie', async () => {
    h.read.mockResolvedValue({ state: stateOf(mixed()), session: { cartId: 'cart-1' } });
    h.prepare.mockResolvedValue({
      payments: [{ part: 0, clusterKey: 'collect:mcf-store-nyc-soho', label: 'Malva SoHo', totalCents: 1000 }, { part: 1, clusterKey: 'delivery', label: null, totalCents: 1815 }],
      payCartIds: ['clone-1', 'clone-2'],
    });
    const res = await put({ person: 'other', pickupName: "Sam O'Brien" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as CheckoutState).payments).toHaveLength(2);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('mcf_pay_carts='));
    expect(decodeURIComponent(cookie ?? '')).toContain('"id":"clone-1"');
    expect(decodeURIComponent(cookie ?? '')).toContain('"id":"clone-2"');
    expect(cookie?.toLowerCase()).toContain('httponly');
  });
  it('an unsigned-in subscription rule answers 401', async () => {
    const { EXTRA_BLOCKERS } = await import('@/lib/checkout/guards');
    EXTRA_BLOCKERS.push(() => ({ code: 'sign_in_required' }));
    try {
      h.read.mockResolvedValue({ state: stateOf(viewCart([viewLine({ id: 's1' })])), session: { cartId: 'cart-1' } });
      expect((await put({})).status).toBe(401);
    } finally {
      EXTRA_BLOCKERS.pop();
    }
  });
});
