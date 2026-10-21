// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/client', async () => (await import('@/test/fake-carts')).clientModule());
vi.mock('@/lib/ct/inventory', async () => (await import('@/test/fake-carts')).inventoryModule());
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, v: Record<string, unknown> = {}) => `${key}${v.n ?? v.count ?? ''}`,
}));
vi.mock('@/lib/ct/channels', async () => {
  const { STORE_BK, STORE_SOHO } = await import('@/test/cart');
  return { getStoresForCountry: async (country: string) => (country === 'US' ? [STORE_SOHO, STORE_BK] : []) };
});
vi.mock('@/lib/ct/cart-enrich', async () => {
  const { fake } = await import('@/test/fake-carts');
  const { STORE_BK, STORE_SOHO } = await import('@/test/cart');
  return {
    // The enrichment reads are tested in cart-enrich.test.ts; here they are derived from the fake engine's catalogue and stock.
    getCartEnrichment: async (
      cart: { country?: string; totalPrice: { currencyCode: string }; lineItems: { productId: string; variant?: { sku?: string } }[] },
      ctx: { sessionStoreKey?: string },
    ) => ({
      products: Object.fromEntries(
        cart.lineItems.map((l) => [
          l.productId,
          {
            shape: 'pods',
            variants: {
              [l.variant?.sku ?? '']: {
                attrs: {}, labels: {},
                ...(fake.prices[l.variant?.sku ?? ''] ? { currentPrice: { centAmount: fake.prices[l.variant?.sku ?? ''], currencyCode: cart.totalPrice.currencyCode } } : {}),
              },
            },
          },
        ]),
      ),
      inventory: fake.stock,
      stores: cart.country === 'US' ? [STORE_SOHO, STORE_BK] : [],
      ...(ctx.sessionStoreKey ? { sessionStoreKey: ctx.sessionStoreKey } : {}),
      threshold: { centAmount: 7500, currencyCode: cart.totalPrice.currencyCode },
      policies: {}, nudge: null,
    }),
  };
});

import { DELETE, PATCH as patchLine } from './lines/[lineId]/route';
import { GET as getCount } from './count/route';
import { GET, PATCH } from './route';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';
import type { Cart } from '@/lib/types';
import { STORE_BK, STORE_SOHO, ctLine } from '@/test/cart';
import { fake, seedCart } from '@/test/fake-carts';

const ctx = (lineId = 'x') => ({ params: Promise.resolve({ lineId }) });
const setSession = async (s: Record<string, string>) => jar.store.set(SESSION_COOKIE, await createSessionToken(s));
const sessionOf = async (res: Response) => {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? verifySessionToken(cookie.split(';')[0].slice(SESSION_COOKIE.length + 1)) : undefined;
};
const get = () => GET(new Request('http://x/api/cart'), ctx());
const patch = (body: unknown) => PATCH(new Request('http://x/api/cart', { method: 'PATCH', body: JSON.stringify(body) }), ctx());
const patchL = (id: string, body: unknown) => patchLine(new Request('http://x/api/cart/lines/x', { method: 'PATCH', body: JSON.stringify(body) }), ctx(id));
const del = (id: string) => DELETE(new Request('http://x/api/cart/lines/x', { method: 'DELETE' }), ctx(id));
const cartOf = async (res: Response) => ((await res.json()) as { cart: Cart }).cart;
const errOf = async (res: Response) => ((await res.json()) as { error: Record<string, unknown> }).error;
const engine = (id: string) => fake.carts.get(id) as { version: number; lineItems: { id: string; quantity: number; supplyChannel?: { id: string }; custom?: { fields: { fulfilment: string } } }[]; taxedPrice: { totalGross: { centAmount: number } }; discountCodes: unknown[] };

/** A signed-in-as-guest session with a cart holding the given lines. */
async function bag(lines: Parameters<typeof ctLine>[0][], over: Record<string, unknown> = {}, session: Record<string, string> = {}) {
  const id = seedCart({ lineItems: lines.map((l) => ctLine({ cents: fake.prices[l.sku] ?? 1000, ...l })), ...over });
  fake.carts.get(id)!.version = 1;
  await setSession({ cartId: id, anonymousId: 'anon-1', country: 'US', currency: 'USD', locale: 'en-US', ...session });
  return id;
}

beforeEach(() => {
  jar.store.clear();
  fake.reset();
  fake.prices = { S1: 1000, S2: 2000, S3: 3000 };
  fake.stock = { S1: { online: 50, stores: { 'ch-soho': 20, 'ch-bk': 0 } }, S2: { online: 50, stores: { 'ch-soho': 20, 'ch-bk': 20 } }, S3: { online: 2, stores: {} } };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/cart (I-03)', () => {
  it('non active cart clears cartId', async () => {
    const id = seedCart({ cartState: 'Ordered' });
    await setSession({ cartId: id, anonymousId: 'anon-1' });
    const res = await get();
    expect(await res.json()).toEqual({ cart: null });
    const s = await sessionOf(res);
    expect(s?.cartId).toBeUndefined();
    expect(s?.anonymousId).toBe('anon-1');
  });

  it('foreign cart treated as none', async () => {
    const id = seedCart({ anonymousId: 'someone-else', lineItems: [ctLine({ id: 'a', sku: 'S1' })] });
    await setSession({ cartId: id, anonymousId: 'anon-1' });
    const res = await get();
    expect(await res.json()).toEqual({ cart: null });
    expect((await sessionOf(res))?.cartId).toBeUndefined();
  });

  it('Two shoppers see only their own cart', async () => {
    const mine = await bag([{ id: 'a', sku: 'S1' }]);
    const a = jar.store.get(SESSION_COOKIE)!;
    jar.store.clear();
    await setSession({ cartId: mine, anonymousId: 'anon-2' }); // a different shopper holding the first one's cart id
    expect(await (await get()).json()).toEqual({ cart: null });
    expect(await (await patchL('a', { quantity: 3 })).status).toBe(404); // and cannot write to it
    expect(engine(mine).lineItems[0].quantity).toBe(1);
    jar.store.set(SESSION_COOKIE, a);
    expect((await cartOf(await get())).id).toBe(mine);
  });

  it('shipping method standard when any shippable line else collect', async () => {
    const id = await bag([{ id: 'a', sku: 'S1' }, { id: 'b', sku: 'S2', fulfilment: 'collect', channelId: 'ch-soho' }]);
    const view = await cartOf(await get());
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0].actions).toEqual([{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: 'mcf-ship-standard' } }]);
    expect(view.shipping).toEqual({ amount: { centAmount: 695, currencyCode: 'USD' }, isFree: false });
    await get(); // already right: no write
    expect(fake.updates).toHaveLength(1);

    fake.reset();
    await bag([{ id: 'b', sku: 'S2', fulfilment: 'collect', channelId: 'ch-soho' }]);
    await get();
    expect(fake.updates[0].actions[0]).toMatchObject({ shippingMethod: { key: 'mcf-collect' } });
    expect(id).toBeTruthy();
  });

  it('price check recalculates once and flags the line', async () => {
    const id = await bag([{ id: 'a', sku: 'S1', cents: 1000 }]);
    await get(); // sets shipping
    fake.updates = [];
    fake.prices.S1 = 1200;
    const view = await cartOf(await get());
    expect(fake.updates.filter((u) => u.actions.some((a) => a.action === 'recalculate'))).toHaveLength(1);
    expect(view.lines[0].unitPrice.centAmount).toBe(1200);
    expect(view.lines[0].notices).toEqual([{ kind: 'price-updated', previous: { centAmount: 1000, currencyCode: 'USD' } }]);
    expect(view.total.centAmount).toBe(engine(id).taxedPrice.totalGross.centAmount);
    // The cart now carries the new price, so a reload recalculates nothing.
    fake.updates = [];
    expect((await cartOf(await get())).lines[0].notices).toEqual([]);
    expect(fake.updates).toHaveLength(0);
  });

  it('no check on the count endpoint', async () => {
    await bag([{ id: 'a', sku: 'S1', cents: 1000, quantity: 2 }]);
    fake.prices.S1 = 1200;
    const res = await getCount(new Request('http://x/api/cart/count'), ctx());
    expect(await res.json()).toEqual({ count: 2 });
    expect(fake.updates).toHaveLength(0);
  });

  it('502 maps to upstream_unavailable', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    fake.readError = Object.assign(new Error('boom'), { statusCode: 502 });
    const res = await get();
    expect(res.status).toBe(503);
    expect((await errOf(res)).code).toBe('upstream_unavailable');
  });

  it('a cart whose shipping mode differs from the constant is rebuilt in the configured mode', async () => {
    const old = await bag([{ id: 'a', sku: 'S1', quantity: 2 }], { shippingMode: 'Multiple' });
    const res = await get();
    const view = await cartOf(res);
    expect(view.shippingMode).toBe('Single');
    expect(view.id).not.toBe(old);
    expect(view.lines).toMatchObject([{ sku: 'S1', quantity: 2 }]);
    expect((await sessionOf(res))?.cartId).toBe(view.id);
    expect(fake.carts.get(old)!.deleteDaysAfterLastModification).toBe(1);
  });

  it('without a cart returns null and no cookie change', async () => {
    const res = await get();
    expect(await res.json()).toEqual({ cart: null });
    expect(res.headers.getSetCookie()).toHaveLength(0);
  });
});

describe('line mutations (I-04)', () => {
  it('Quantity changed re-reads totals from the cart not client side', async () => {
    const id = await bag([{ id: 'a', sku: 'S1', cents: 1000 }]);
    fake.taxPercent = 13; // an engine rule the storefront does not know
    const res = await patchL('a', { quantity: 3 });
    expect(res.status).toBe(200);
    const view = await cartOf(res);
    expect(fake.updates[0].actions[0]).toEqual({ action: 'changeLineItemQuantity', lineItemId: 'a', quantity: 3 });
    expect(view.total.centAmount).toBe(engine(id).taxedPrice.totalGross.centAmount);
    expect(view.lines[0]).toMatchObject({ quantity: 3, total: { centAmount: 3000 } });
    fake.taxPercent = 8;
  });

  it('quantity floor 1 and ceiling 99 and stock clamp', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    for (const bad of [0, -1, 100, 1.5, '2', null]) {
      expect((await patchL('a', { quantity: bad })).status, String(bad)).toBe(400);
    }
    expect(fake.updates).toHaveLength(0);
    expect((await patchL('a', { quantity: 50 })).status).toBe(200);
    expect((await patchL('a', { quantity: 51 })).status).toBe(409); // online stock is 50
  });

  it('quantity_exceeds_stock carries available', async () => {
    await bag([{ id: 'a', sku: 'S3', quantity: 1 }]);
    const res = await patchL('a', { quantity: 3 });
    expect(res.status).toBe(409);
    expect(await errOf(res)).toMatchObject({ code: 'quantity_exceeds_stock', available: 2 });
  });

  it('lowering the quantity is always allowed', async () => {
    await bag([{ id: 'a', sku: 'S3', quantity: 5 }]); // more than the stock of 2
    expect((await patchL('a', { quantity: 4 })).status).toBe(200);
  });

  it('Double click retries once on 409 and applies once', async () => {
    const id = await bag([{ id: 'a', sku: 'S1' }]);
    fake.conflicts = 1;
    const res = await patchL('a', { quantity: 2 });
    expect(res.status).toBe(200);
    const writes = fake.updates.filter((u) => u.actions[0].action === 'changeLineItemQuantity');
    expect(writes).toHaveLength(2);
    expect(writes[1].version).toBeGreaterThan(writes[0].version);
    expect(engine(id).lineItems[0].quantity).toBe(2);
  });

  it('second conflict returns conflict', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    fake.conflicts = 2;
    const res = await patchL('a', { quantity: 2 });
    expect(res.status).toBe(409);
    expect((await errOf(res)).code).toBe('conflict');
  });

  it('Last line removed returns an empty cart and keeps cartId', async () => {
    const id = await bag([{ id: 'a', sku: 'S1' }]);
    const res = await del('a');
    expect(res.status).toBe(200);
    const view = await cartOf(res);
    expect(view).toMatchObject({ id, lines: [], groups: [], count: 0, canCheckout: false });
    expect(res.headers.getSetCookie()).toHaveLength(0); // the session keeps its cartId
  });

  it('unknown line 404', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    expect((await patchL('nope', { quantity: 2 })).status).toBe(404);
    expect(await errOf(await del('nope'))).toMatchObject({ code: 'line_not_found' });
    expect((await del('bad id!')).status).toBe(404);
  });

  it('bad body is invalid_request', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    expect((await patchL('a', {})).status).toBe(400);
    expect((await patchL('a', { fulfilment: 'pigeon' })).status).toBe(400);
  });
});

describe('fulfilment switch and store change (I-05)', () => {
  it('Switch to ship removes the supply channel and sets the field', async () => {
    await bag([{ id: 'a', sku: 'S1', fulfilment: 'collect', channelId: 'ch-soho' }]);
    const res = await patchL('a', { fulfilment: 'delivery' });
    expect(res.status).toBe(200);
    expect(fake.updates[0].actions).toEqual([
      { action: 'setLineItemSupplyChannel', lineItemId: 'a' },
      { action: 'setLineItemCustomField', lineItemId: 'a', name: 'fulfilment', value: 'delivery' },
    ]);
    const view = await cartOf(res);
    expect(view.lines[0]).toMatchObject({ fulfilment: 'delivery', groupKey: 'delivery' });
    expect(view.lines[0].store).toBeUndefined();
  });

  it('Merge uses one update with quantity change plus remove', async () => {
    await bag([{ id: 'a', sku: 'S1', quantity: 2, fulfilment: 'collect', channelId: 'ch-soho' }, { id: 'b', sku: 'S1', quantity: 3 }]);
    const res = await patchL('a', { fulfilment: 'delivery' });
    expect(fake.updates[0].actions).toEqual([
      { action: 'changeLineItemQuantity', lineItemId: 'b', quantity: 5 },
      { action: 'removeLineItem', lineItemId: 'a' },
    ]);
    const view = await cartOf(res);
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]).toMatchObject({ id: 'b', quantity: 5 });
  });

  it('switch to collect needs a store and stock', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    const empty = await patchL('a', { fulfilment: 'collect', storeKey: STORE_BK.key }); // S1 has 0 at Brooklyn
    expect(empty.status).toBe(409);
    expect(await errOf(empty)).toMatchObject({ code: 'not_available_for_collection', available: 0 });
    expect(fake.updates).toHaveLength(0);

    const ok = await patchL('a', { fulfilment: 'collect', storeKey: STORE_SOHO.key });
    expect(ok.status).toBe(200);
    expect(fake.updates[0].actions).toEqual([
      { action: 'setLineItemSupplyChannel', lineItemId: 'a', supplyChannel: { typeId: 'channel', id: 'ch-soho' } },
      { action: 'setLineItemCustomField', lineItemId: 'a', name: 'fulfilment', value: 'collect' },
    ]);
    const view = await cartOf(ok);
    expect(view.lines[0]).toMatchObject({ fulfilment: 'collect', groupKey: `collect:${STORE_SOHO.key}` });
  });

  it('store_required when no session store', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    const res = await patchL('a', { fulfilment: 'collect' });
    expect(res.status).toBe(409);
    expect((await errOf(res)).code).toBe('store_required');
    // The chosen store in the session is used when none is sent.
    await setSession({ cartId: [...fake.carts.keys()][0], anonymousId: 'anon-1', collectionStoreKey: STORE_SOHO.key });
    expect((await patchL('a', { fulfilment: 'collect' })).status).toBe(200);
  });

  it('a Canada session cannot create collect lines', async () => {
    await bag([{ id: 'a', sku: 'S1' }], { country: 'CA' }, { country: 'CA', currency: 'CAD', locale: 'en-CA' });
    const res = await patchL('a', { fulfilment: 'collect', storeKey: STORE_SOHO.key });
    expect(res.status).toBe(400);
    expect((await errOf(res)).code).toBe('collect_not_available_in_market');
  });

  it('unknown store is refused', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    const res = await patchL('a', { fulfilment: 'collect', storeKey: 'mcf-store-nowhere' });
    expect(res.status).toBe(400);
    expect((await errOf(res)).code).toBe('unknown_store');
  });

  it('subscribe lines are not switchable', async () => {
    await bag([{ id: 's', sku: 'S1', fulfilment: 'subscribe', policyId: 'rp-1' }]);
    const res = await patchL('s', { fulfilment: 'delivery' });
    expect(res.status).toBe(422);
    expect((await errOf(res)).code).toBe('subscribe_line_not_switchable');
  });

  it('switching the last shipping line to collect prices shipping with the collect method', async () => {
    await bag([{ id: 'a', sku: 'S2' }]);
    await get(); // standard method set
    fake.updates = [];
    await patchL('a', { fulfilment: 'collect', storeKey: STORE_SOHO.key });
    expect(fake.updates).toHaveLength(2);
    expect(fake.updates[1].actions[0]).toMatchObject({ action: 'setShippingMethod', shippingMethod: { key: 'mcf-collect' } });
  });

  it('change store moves collect lines and merges duplicates', async () => {
    const id = await bag([
      { id: 'a', sku: 'S2', quantity: 1, fulfilment: 'collect', channelId: 'ch-soho' },
      { id: 'b', sku: 'S2', quantity: 2, fulfilment: 'collect', channelId: 'ch-bk' },
      { id: 'c', sku: 'S1', quantity: 1 },
    ]);
    const res = await patch({ action: 'changeCollectionStore', storeKey: STORE_BK.key });
    expect(res.status).toBe(200);
    expect(fake.updates[0].actions).toEqual([
      { action: 'changeLineItemQuantity', lineItemId: 'b', quantity: 3 },
      { action: 'removeLineItem', lineItemId: 'a' },
    ]);
    const view = await cartOf(res);
    expect(view.groups.map((g) => g.key)).toEqual([`collect:${STORE_BK.key}`, 'delivery']);
    expect(engine(id).lineItems.map((l) => l.id)).toEqual(['b', 'c']);
  });

  it('lines out of stock at the new store keep the flag', async () => {
    await bag([{ id: 'a', sku: 'S1', fulfilment: 'collect', channelId: 'ch-soho' }]);
    const view = await cartOf(await patch({ action: 'changeCollectionStore', storeKey: STORE_BK.key })); // S1 has 0 at Brooklyn
    expect(view.lines[0].store?.key).toBe(STORE_BK.key);
    expect(view.lines[0].notices).toEqual([{ kind: 'collect-unavailable' }]);
    expect(view.blockers).toContain('collect-unavailable');
  });

  it('change store validates the store and the market', async () => {
    await bag([{ id: 'a', sku: 'S1', fulfilment: 'collect', channelId: 'ch-soho' }]);
    expect((await patch({ action: 'changeCollectionStore', storeKey: 'nope' })).status).toBe(400);
    expect((await patch({ action: 'changeCollectionStore' })).status).toBe(400);
  });

  it('ship twin and collect twin are never merged across fulfilment', async () => {
    await bag([{ id: 'a', sku: 'S1', fulfilment: 'collect', channelId: 'ch-soho' }, { id: 'b', sku: 'S1' }]);
    const view = await cartOf(await patch({ action: 'changeCollectionStore', storeKey: STORE_SOHO.key })); // nothing to move
    expect(view.lines).toHaveLength(2);
    expect(fake.updates.filter((u) => u.actions.some((a) => a.action === 'removeLineItem'))).toHaveLength(0);
  });
});

describe('discount codes (I-06)', () => {
  const spy = () => [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'info')];

  it('Discount code rejected tells why and leaves totals unchanged', async () => {
    fake.codes = { OLD: { id: 'c-old', reject: 'NotActive' }, BIG: { id: 'c-big', minNet: 100000 } };
    const id = await bag([{ id: 'a', sku: 'S1', quantity: 2 }]);
    const before = engine(id).taxedPrice?.totalGross?.centAmount;
    for (const [code, reason] of [['NOPE123', 'DoesNotExist'], ['OLD', 'NotActive'], ['BIG', 'DoesNotMatchCart'], ['bad code!', 'DoesNotExist']] as const) {
      const res = await patch({ action: 'applyDiscountCode', code });
      expect(res.status, code).toBe(422);
      const error = await errOf(res);
      expect(error.code).toBe('code_not_applied');
      const details = error.details as { reason: string; cart: Cart };
      expect(details.reason).toBe(reason);
      expect(details.cart.codes).toEqual([]);
      expect(details.cart.lines[0].quantity).toBe(2);
    }
    expect(engine(id).taxedPrice?.totalGross?.centAmount).toBe(before);
    expect(fake.updates.filter((u) => u.actions.some((a) => a.action === 'addDiscountCode')).length).toBeGreaterThan(0);
  });

  it('applying returns engine totals', async () => {
    fake.codes = { WELCOME10: { id: 'c-1', percent: 10 } };
    const id = await bag([{ id: 'a', sku: 'S2', quantity: 2 }]);
    const res = await patch({ action: 'applyDiscountCode', code: '  WELCOME10 ' });
    expect(res.status).toBe(200);
    const view = await cartOf(res);
    expect(view.codes).toEqual([{ id: 'c-1', code: 'WELCOME10', state: 'MatchesCart' }]);
    expect(view.total.centAmount).toBe(engine(id).taxedPrice.totalGross.centAmount);
    expect(fake.updates[0].actions[0]).toEqual({ action: 'addDiscountCode', code: 'WELCOME10' });
  });

  it('Discount stops applying shows the reason after the line it depended on is removed', async () => {
    fake.codes = { COFFEE15: { id: 'c-2', percent: 15, minNet: 6000 } };
    await bag([{ id: 'a', sku: 'S2', quantity: 2 }, { id: 'b', sku: 'S3', quantity: 1 }]); // 7000 net
    expect((await cartOf(await patch({ action: 'applyDiscountCode', code: 'COFFEE15' }))).codes[0].state).toBe('MatchesCart');
    const view = await cartOf(await del('b')); // 4000 left: below the 6000 predicate
    expect(view.codes[0]).toMatchObject({ code: 'COFFEE15', state: 'DoesNotMatchCart', reasonKey: 'code.reason.DoesNotMatchCart' });
  });

  it('remove code', async () => {
    fake.codes = { WELCOME10: { id: 'c-1', percent: 10 } };
    await bag([{ id: 'a', sku: 'S2' }]);
    await patch({ action: 'applyDiscountCode', code: 'WELCOME10' });
    const view = await cartOf(await patch({ action: 'removeDiscountCode', id: 'c-1' }));
    expect(view.codes).toEqual([]);
    expect(fake.updates.at(-1)!.actions[0]).toEqual({ action: 'removeDiscountCode', discountCode: { typeId: 'discount-code', id: 'c-1' } });
  });

  it('code text never logged', async () => {
    fake.codes = { SECRETCODE: { id: 'c-1', reject: 'NotActive' } };
    await bag([{ id: 'a', sku: 'S2' }]);
    const spies = spy();
    await patch({ action: 'applyDiscountCode', code: 'SECRETCODE' });
    await patch({ action: 'applyDiscountCode', code: 'UNKNOWNCODE' });
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toMatch(/SECRETCODE|UNKNOWNCODE/);
  });

  it('a malformed action is invalid_request', async () => {
    await bag([{ id: 'a', sku: 'S1' }]);
    expect((await patch({ action: 'explode' })).status).toBe(400);
    expect((await patch({ action: 'removeDiscountCode', id: '../x' })).status).toBe(400);
  });
});
