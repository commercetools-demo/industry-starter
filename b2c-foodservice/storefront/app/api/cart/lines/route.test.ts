// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({
  carts: new Map<string, Record<string, unknown>>(),
  created: [] as Record<string, unknown>[],
  updates: [] as { id: string; body: { version: number; actions: Record<string, unknown>[] } }[],
  conflicts: 0,
  updateError: undefined as unknown,
  n: 0,
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    carts: () => ({
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          ct.n += 1;
          const cart = { id: `cart-${ct.n}`, version: 1, cartState: 'Active', lineItems: [], totalPrice: { centAmount: 0, currencyCode: body.currency }, ...body };
          ct.carts.set(cart.id, cart);
          ct.created.push(body);
          return { body: cart };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            const c = ct.carts.get(ID);
            if (!c) throw Object.assign(new Error('nf'), { statusCode: 404 });
            return { body: c };
          },
        }),
        post: ({ body }: { body: { version: number; actions: Record<string, unknown>[] } }) => ({
          execute: async () => {
            ct.updates.push({ id: ID, body });
            if (ct.updateError) throw ct.updateError;
            if (ct.conflicts > 0) {
              ct.conflicts -= 1;
              throw Object.assign(new Error('conflict'), { statusCode: 409 });
            }
            const c = ct.carts.get(ID) as { version: number; lineItems: unknown[] };
            const a = body.actions[0] as { sku: string; quantity: number };
            const next = { ...c, version: c.version + 1, lineItems: [...c.lineItems, { id: `li-${c.lineItems.length + 1}`, quantity: a.quantity, variant: { sku: a.sku }, productId: 'p-1', name: { 'en-US': 'x' }, productSlug: { 'en-US': 'x' }, price: { value: { centAmount: 100, currencyCode: 'USD' } }, totalPrice: { centAmount: 100 * a.quantity, currencyCode: 'USD' } }] };
            ct.carts.set(ID, next);
            return { body: next };
          },
        }),
      }),
    }),
  },
}));

// The full view (GET) reads more than the add path: its enrichment reads and the translator are stubbed here and tested on their own.
vi.mock('@/lib/ct/cart-enrich', async () => ({ getCartEnrichment: async () => (await import('@/lib/mappers/cart')).EMPTY_ENRICHMENT }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));

import { GET as getCart } from '../route';
import { POST } from './route';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';

const post = (body: unknown) =>
  POST(new Request('http://x/api/cart/lines', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({}) });
const sessionOf = async (res: Response) => {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return verifySessionToken(cookie?.split(';')[0]?.slice(SESSION_COOKIE.length + 1));
};
const setSession = async (s: Record<string, string>) => jar.store.set(SESSION_COOKIE, await createSessionToken(s));
const ok = { sku: 'MCF-POD-EMBER-10', quantity: 1, fulfilment: 'delivery' };

beforeEach(() => {
  jar.store.clear();
  ct.carts.clear();
  ct.created = [];
  ct.updates = [];
  ct.conflicts = 0;
  ct.updateError = undefined;
  ct.n = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/cart/lines', () => {
  it('creates a cart for the session market when none exists', async () => {
    await setSession({ country: 'CA', currency: 'CAD', locale: 'en-CA' });
    const res = await post(ok);
    expect(res.status).toBe(200);
    expect(ct.created[0]).toMatchObject({ currency: 'CAD', country: 'CA', locale: 'en-CA', shippingMode: 'Single', taxMode: 'Platform', shippingAddress: { country: 'CA' }, deleteDaysAfterLastModification: 30 });
  });
  it('uses anonymousId for a guest and customerId when signed in', async () => {
    await post(ok);
    expect(ct.created[0]!.anonymousId).toEqual(expect.any(String));
    expect(ct.created[0]!.customerId).toBeUndefined();
    jar.store.clear();
    await setSession({ customerId: 'cust-1' });
    await post(ok);
    expect(ct.created[1]!.customerId).toBe('cust-1');
    expect(ct.created[1]!.anonymousId).toBeUndefined();
  });
  it('adds quantity 3 as one line with the fulfilment field', async () => {
    const res = await post({ ...ok, quantity: 3 });
    const { cart } = (await res.json()) as { cart: { count: number; lines: unknown[] } };
    expect(cart.count).toBe(3);
    expect(cart.lines).toHaveLength(1);
    expect(ct.updates[0]!.body.actions[0]).toMatchObject({
      action: 'addLineItem', sku: ok.sku, quantity: 3,
      custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'delivery' } },
    });
  });
  it('session cookie gets cartId and anonymousId', async () => {
    const s = await sessionOf(await post(ok));
    expect(s.cartId).toBe('cart-1');
    expect(s.anonymousId).toEqual(expect.any(String));
  });
  it('retries once on 409 then succeeds', async () => {
    ct.conflicts = 1;
    expect((await post(ok)).status).toBe(200);
    expect(ct.updates).toHaveLength(2);
  });
  it('retries once on 409 then reports conflict', async () => {
    ct.conflicts = 2;
    const res = await post(ok);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('conflict');
  });
  it('maps no-price error to 422', async () => {
    ct.updateError = Object.assign(new Error('x'), { statusCode: 400, body: { errors: [{ code: 'MissingPriceForProduct', message: 'no price' }] } });
    const res = await post(ok);
    expect(res.status).toBe(422);
  });
  it('maps an unknown sku to 404', async () => {
    ct.updateError = Object.assign(new Error('x'), { statusCode: 400, body: { errors: [{ code: 'InvalidOperation', message: "A product with SKU 'zz' not found." }] } });
    expect((await post(ok)).status).toBe(404);
  });
  it('rejects quantity 0 and 100 and bad sku', async () => {
    for (const bad of [{ ...ok, quantity: 0 }, { ...ok, quantity: 100 }, { ...ok, quantity: 1.5 }, { ...ok, sku: 'a b"' }, { ...ok, sku: '' }, { ...ok, fulfilment: 'pigeon' }, null]) {
      expect((await post(bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect(ct.created).toHaveLength(0);
  });
  it('collect and subscribe need their key (the branches themselves are tested in route-fulfilment.test.ts)', async () => {
    expect((await post({ ...ok, fulfilment: 'collect' })).status).toBe(400);
    expect((await post({ ...ok, fulfilment: 'subscribe' })).status).toBe(400);
    expect(ct.created).toHaveLength(0);
  });
  it('a second add reuses the cart from the session', async () => {
    const first = await post(ok);
    jar.store.set(SESSION_COOKIE, await createSessionToken(await sessionOf(first)));
    const second = await post(ok);
    expect(ct.created).toHaveLength(1);
    expect(((await second.json()) as { cart: { count: number } }).cart.count).toBe(2);
  });
});

describe('GET /api/cart', () => {
  const get = () => getCart(new Request('http://x/api/cart'), { params: Promise.resolve({}) });
  it('non-active cart clears cartId and returns null', async () => {
    ct.carts.set('c9', { id: 'c9', version: 1, cartState: 'Ordered', lineItems: [] });
    await setSession({ cartId: 'c9', anonymousId: 'a' });
    const res = await get();
    expect(await res.json()).toEqual({ cart: null });
    const s = await sessionOf(res);
    expect(s.cartId).toBeUndefined();
    expect(s.anonymousId).toBe('a');
  });
  it('a deleted cart (404) also returns null', async () => {
    await setSession({ cartId: 'gone' });
    expect(await (await get()).json()).toEqual({ cart: null });
  });
  it('two shoppers get only their own cart', async () => {
    await setSession({ anonymousId: 'a' });
    const a = await sessionOf(await post(ok));
    jar.store.clear();
    expect(await (await get()).json()).toEqual({ cart: null });
    jar.store.set(SESSION_COOKIE, await createSessionToken(a));
    const mine = (await (await get()).json()) as { cart: { id: string } };
    expect(mine.cart.id).toBe('cart-1');
  });
  it('without a cart returns null and no cookie change', async () => {
    const res = await get();
    expect(await res.json()).toEqual({ cart: null });
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});
