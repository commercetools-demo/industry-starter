// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const h = vi.hoisted(() => ({
  updates: [] as { body: { version: number; actions: Record<string, unknown>[] } }[],
  carts: new Map<string, Record<string, unknown>>(),
  stock: vi.fn(),
  policy: vi.fn(),
  product: vi.fn(),
  stores: vi.fn(),
  updateError: undefined as unknown,
  n: 0,
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    carts: () => ({
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          h.n += 1;
          const cart = { id: `cart-${h.n}`, version: 1, cartState: 'Active', lineItems: [], ...body };
          h.carts.set(cart.id, cart);
          return { body: cart };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => ({ body: h.carts.get(ID) }) }),
        post: ({ body }: { body: { version: number; actions: Record<string, unknown>[] } }) => ({
          execute: async () => {
            h.updates.push({ body });
            if (h.updateError) throw h.updateError;
            const c = h.carts.get(ID) as { version: number; lineItems: unknown[] };
            const a = body.actions[0] as { sku: string; quantity: number };
            const next = { ...c, version: c.version + 1, lineItems: [...c.lineItems, { id: 'li-1', quantity: a.quantity, variant: { sku: a.sku } }] };
            h.carts.set(ID, next);
            return { body: next };
          },
        }),
      }),
    }),
  },
}));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: h.stores }));
vi.mock('@/lib/ct/product-detail', () => ({ getRecurrencePolicyByKey: h.policy, getProductBySku: h.product }));
vi.mock('@/lib/ct/inventory', async (orig) => ({ ...(await orig<typeof import('@/lib/ct/inventory')>()), getStoreStock: h.stock }));

import { POST } from './route';
import { buildAddLineAction } from '@/lib/ct/cart';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

const post = (body: unknown) =>
  POST(new Request('http://x/api/cart/lines', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({}) });
const body = async (res: Response) => (await res.json()) as { error?: { code: string; available?: number }; cart?: { count: number } };
const action = () => h.updates[0]?.body.actions[0] as Record<string, unknown>;

const SOHO = { id: 'ch-soho', key: 'mcf-store-nyc-soho' };
const BK = { id: 'ch-bk', key: 'mcf-store-brooklyn' };
const collect = { sku: 'POD-10', quantity: 2, fulfilment: 'collect', storeKey: SOHO.key };
const subscribe = { sku: 'POD-10', quantity: 1, fulfilment: 'subscribe', recurrencePolicyKey: 'mcf-every-month' };

const projection = (over: { subscribable?: boolean; policyId?: string; country?: string; currency?: string; cents?: number } = {}) => ({
  attributes: [{ name: 'subscribable', value: over.subscribable ?? true }],
  masterVariant: {
    sku: 'POD-10',
    recurrencePrices: [{
      value: { currencyCode: over.currency ?? 'USD', centAmount: over.cents ?? 531 }, country: over.country ?? 'US',
      recurrencePolicy: { typeId: 'recurrence-policy', id: over.policyId ?? 'rp-1m' },
    }],
  },
  variants: [],
});

beforeEach(async () => {
  jar.store.clear();
  jar.store.set(SESSION_COOKIE, await createSessionToken({ country: 'US', currency: 'USD', locale: 'en-US', anonymousId: 'a' }));
  h.updates = [];
  h.carts.clear();
  h.n = 0;
  h.updateError = undefined;
  h.stores.mockReset().mockResolvedValue([SOHO, BK]);
  h.stock.mockReset().mockResolvedValue(20);
  h.policy.mockReset().mockResolvedValue({ id: 'rp-1m', key: 'mcf-every-month', name: 'Every month', schedule: { unit: 'Months', value: 1 } });
  h.product.mockReset().mockResolvedValue(projection());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/cart/lines collect', () => {
  it('Reserve adds a collect line with the store as supplyChannel and the fulfilment field', async () => {
    const res = await post(collect);
    expect(res.status).toBe(200);
    expect(action()).toEqual({
      action: 'addLineItem', sku: 'POD-10', quantity: 2,
      supplyChannel: { typeId: 'channel', id: 'ch-soho' },
      custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'collect' } },
    });
    expect(typeof (action().supplyChannel as { id: unknown }).id).toBe('string');
    expect(h.stock).toHaveBeenCalledWith('POD-10', 'ch-soho');
  });

  it('collect rejects an unknown store', async () => {
    const res = await post({ ...collect, storeKey: 'mcf-store-nowhere' });
    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe('unknown_store');
    expect(h.updates).toHaveLength(0);
    expect(h.stock).not.toHaveBeenCalled();
  });

  it('collect rejects an empty store with the available quantity', async () => {
    h.stock.mockResolvedValue(1);
    const res = await post(collect); // wants 2
    expect(res.status).toBe(409);
    expect(await body(res)).toMatchObject({ error: { code: 'not_available_for_collection', available: 1 } });
    h.stock.mockResolvedValue(0);
    expect((await post({ ...collect, quantity: 1 })).status).toBe(409);
    expect(h.updates).toHaveLength(0);
    expect(h.carts.size).toBe(0); // no cart was created for a refused line
  });

  it('Canada market renders no Collect card and add-line collect is refused', async () => {
    jar.store.set(SESSION_COOKIE, await createSessionToken({ country: 'CA', currency: 'CAD', locale: 'en-CA', anonymousId: 'a' }));
    const res = await post(collect);
    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe('collect_not_available_in_market');
    expect(h.stores).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });

  it('a store key with unsafe characters is refused before any call', async () => {
    expect((await post({ ...collect, storeKey: 'a" or 1=1' })).status).toBe(400);
    expect(h.stores).not.toHaveBeenCalled();
  });

  it('different stores make different lines, and a delivery line is another line again', () => {
    const a = buildAddLineAction({ sku: 'S', quantity: 1, fulfilment: 'collect', storeKey: 'a' }, { channelId: 'ch-a' });
    const b = buildAddLineAction({ sku: 'S', quantity: 1, fulfilment: 'collect', storeKey: 'b' }, { channelId: 'ch-b' });
    const d = buildAddLineAction({ sku: 'S', quantity: 1, fulfilment: 'delivery' });
    expect(a.supplyChannel).not.toEqual(b.supplyChannel);
    expect(d.supplyChannel).toBeUndefined();
    expect(a.custom).not.toEqual(d.custom);
  });
});

describe('POST /api/cart/lines subscribe', () => {
  it('subscribe attaches recurrenceInfo Fixed and fulfilment subscribe', async () => {
    const res = await post(subscribe);
    expect(res.status).toBe(200);
    expect(action()).toEqual({
      action: 'addLineItem', sku: 'POD-10', quantity: 1,
      recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp-1m' }, priceSelectionMode: 'Fixed' },
      custom: { type: { typeId: 'type', key: 'mcf-line-fulfilment' }, fields: { fulfilment: 'subscribe' } },
    });
    expect(action().supplyChannel).toBeUndefined();
  });

  it('one-time line has no recurrenceInfo key', async () => {
    await post({ sku: 'POD-10', quantity: 1, fulfilment: 'delivery' });
    await post(collect);
    for (const u of h.updates) expect(Object.keys(u.body.actions[0] as object)).not.toContain('recurrenceInfo');
    expect(Object.keys(buildAddLineAction({ sku: 'S', quantity: 1, fulfilment: 'delivery' }))).not.toContain('recurrenceInfo');
    expect(Object.keys(buildAddLineAction({ sku: 'S', quantity: 1, fulfilment: 'delivery' }))).not.toContain('supplyChannel');
  });

  it('subscribe rejects a policy without a price', async () => {
    h.product.mockResolvedValue(projection({ policyId: 'rp-other' }));
    const res = await post(subscribe);
    expect(res.status).toBe(422);
    expect((await body(res)).error?.code).toBe('price_unavailable');
    h.product.mockResolvedValue(projection({ currency: 'CAD', country: 'CA' }));
    expect((await post(subscribe)).status).toBe(422); // a price in another market does not count
    h.product.mockResolvedValue(projection({ cents: 0 }));
    expect((await post(subscribe)).status).toBe(422);
    expect(h.updates).toHaveLength(0);
  });

  it('subscribe rejects a product that is not subscribable and an unknown policy', async () => {
    h.product.mockResolvedValue(projection({ subscribable: false }));
    expect((await post(subscribe)).status).toBe(422);
    h.policy.mockResolvedValue(null);
    const res = await post(subscribe);
    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe('unknown_policy');
  });

  it('an unknown product is not found', async () => {
    h.product.mockResolvedValue(null);
    expect((await post(subscribe)).status).toBe(404);
  });

  it('a platform refusal for the price is the same price_unavailable answer', async () => {
    h.updateError = Object.assign(new Error('x'), { statusCode: 400, body: { errors: [{ code: 'MissingPriceForProduct', message: 'no price' }] } });
    const res = await post(subscribe);
    expect(res.status).toBe(422);
    expect((await body(res)).error?.code).toBe('price_unavailable');
  });

  it('the error body never carries commercetools text', async () => {
    h.updateError = Object.assign(new Error('internal secret detail'), { statusCode: 500, body: { errors: [{ code: 'General', message: 'internal secret detail' }] } });
    const res = await post(collect);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
