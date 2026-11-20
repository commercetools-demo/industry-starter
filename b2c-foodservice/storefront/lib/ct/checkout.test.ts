import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart, ctLine, STORE_SOHO, viewCart, viewLine } from '@/test/cart';

const h = vi.hoisted(() => ({
  view: null as unknown,
  raw: null as unknown,
  byId: {} as Record<string, unknown>,
  posted: [] as { id: string; body: unknown }[],
  created: [] as unknown[],
  conflictOnce: false,
  /** What `syncShipping` was called with, and the cart it returns (null: the cart it was given). */
  sync: [] as { cart: unknown; opts: unknown }[],
  synced: null as unknown,
}));

vi.mock('@/lib/ct/cart', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/cart')>()),
  getCartView: vi.fn(async () => ({ cart: h.view, session: {} })),
  getOwnedCartForRebuild: vi.fn(async () => h.raw),
  syncShipping: vi.fn(async (cart: unknown, opts: unknown) => {
    h.sync.push({ cart, opts });
    return h.synced ?? cart;
  }),
}));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: vi.fn(async () => [STORE_SOHO]) }));
vi.mock('@/lib/ct/public-cache', () => ({ cachedPublic: (_k: string, _p: string[], fn: unknown) => fn }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    types: () => ({ withKey: () => ({ get: () => ({ execute: async () => ({ body: { id: 'type-instore' } }) }) }) }),
    shippingMethods: () => ({ withKey: () => ({ get: () => ({ execute: async () => ({ body: { localizedDescription: { 'en-US': '2-4 business days' } } }) }) }) }),
    carts: () => ({
      post: ({ body }: { body: unknown }) => ({
        execute: async () => {
          h.created.push(body);
          return { body: { ...(h.raw as object), id: `clone-${h.created.length}`, version: 1 } };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => ({ body: { ...((h.byId[ID] ?? h.raw) as object), id: ID } }) }),
        post: ({ body }: { body: { version: number } }) => ({
          execute: async () => {
            if (h.conflictOnce) {
              h.conflictOnce = false;
              throw Object.assign(new Error('conflict'), { statusCode: 409 });
            }
            h.posted.push({ id: ID, body });
            return { body: { ...(h.raw as object), id: ID, version: body.version + 1 } };
          },
        }),
      }),
    }),
  },
}));

import { resetOrderTypeCache } from './order-type';
import { getCheckoutState, isCollectReady, missingForPayment, preparePayments, removePaidLines, CheckoutNotReady } from './checkout';

const perGroup = 'complete-per-group' as const;
const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const session = { anonymousId: 'anon', cartId: 'cart-1' };
const collectLine = viewLine({ id: 'c1', fulfilment: 'collect', store: STORE_SOHO });
const shipLine = viewLine({ id: 's1' });

function rawMixed() {
  return ctCart({
    anonymousId: 'anon',
    lines: [ctLine({ id: 'c1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' }), ctLine({ id: 's1', sku: 'B' }), ctLine({ id: 'u1', sku: 'C', fulfilment: 'subscribe', policyId: 'pol-1' })],
    codes: [{ id: 'dc1', code: 'WELCOME10', state: 'MatchesCart' }],
  });
}

beforeEach(() => {
  h.posted = [];
  h.created = [];
  h.byId = {};
  h.conflictOnce = false;
  h.sync = [];
  h.synced = null;
});

describe('getCheckoutState', () => {
  it('returns every line with its group key, pickup, delivery note and codes', async () => {
    h.view = viewCart([collectLine, shipLine]);
    h.raw = rawMixed();
    const { state } = await getCheckoutState(session, market, new Date('2026-10-21T15:00:00Z'));
    expect(state?.cart.lines.map((l) => [l.id, l.groupKey])).toEqual([['c1', 'collect:mcf-store-nyc-soho'], ['s1', 'delivery']]);
    expect(state?.pickup).toMatchObject({ storeKey: 'mcf-store-nyc-soho', storeName: 'Malva SoHo', readyMinutes: 15 });
    expect(state?.deliveryNote).toEqual({ freeAboveCents: 7500, days: '2-4 business days' });
    expect(state?.strategy).toBe('complete-multiple');
  });
  it('Canada session never gets a pickup', async () => {
    h.view = viewCart([shipLine], { country: 'CA', currency: 'CAD' });
    h.raw = ctCart({ lines: [ctLine({ id: 's1', sku: 'B' })], currency: 'CAD', country: 'CA' });
    const { state } = await getCheckoutState(session, { country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect(state?.pickup).toBeNull();
  });
  it('is null without a bag', async () => {
    h.view = null;
    expect((await getCheckoutState(session, market)).state).toBeNull();
  });
});

describe('missingForPayment', () => {
  it('assertCheckoutReady names what is missing', () => {
    expect(missingForPayment(viewCart([]), null)).toEqual(['lines']);
    expect(missingForPayment(viewCart([collectLine]), '')).toEqual(['pickup']);
    expect(missingForPayment(viewCart([collectLine]), 'Maya Lopez')).toEqual([]);
    expect(missingForPayment(viewCart([shipLine]), null)).toEqual([]);
  });
});

describe('preparePayments', () => {
  it('complete-multiple (the default) pays the bag itself: no clone carts, the pickup name goes into the collect addresses', async () => {
    h.view = viewCart([collectLine, shipLine, viewLine({ id: 'u1', fulfilment: 'subscribe' })]);
    h.raw = rawMixed();
    h.synced = { ...(h.raw as object), taxedPrice: { totalGross: { centAmount: 4321, currencyCode: 'USD' } } };
    const r = await preparePayments(session, market, { pickupName: 'Maya Lopez', email: 'maya@example.com' });
    expect(h.created).toHaveLength(0);
    expect(h.posted).toHaveLength(0);
    expect(r.payCartIds).toEqual([]);
    expect(h.sync).toHaveLength(1);
    expect(h.sync[0]?.opts).toEqual({ pickup: { name: 'Maya Lopez', email: 'maya@example.com' } });
    expect(r.payments).toEqual([{ part: 0, clusterKey: 'collect:mcf-store-nyc-soho', label: expect.any(String), totalCents: 4321 }]);
  });
  it('complete-multiple: a delivery-only bag sends no pickup (nothing to name)', async () => {
    h.view = viewCart([shipLine]);
    h.raw = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 's1', sku: 'B' })] });
    const r = await preparePayments(session, market, { pickupName: null });
    expect(h.sync[0]?.opts).toEqual({});
    expect(r.payments[0]?.clusterKey).toBe('delivery');
    expect(h.created).toHaveLength(0);
  });
  it('complete-per-group clones even a single group (the hosted flow must get a Single cart): the collect clone carries the store address and mcf-collect', async () => {
    h.view = viewCart([collectLine]);
    h.raw = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 'c1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' })] });
    const r = await preparePayments(session, market, { pickupName: 'Maya Lopez' }, perGroup);
    expect(h.posted).toHaveLength(0);
    expect(h.sync).toHaveLength(0);
    expect(r.payCartIds).toHaveLength(1);
    expect(r.payments).toHaveLength(1);
    const [clone] = h.created as { shippingMode: string; shippingAddress: { streetName: string; lastName: string }; shippingMethod: { key: string } }[];
    expect(clone).toMatchObject({ shippingMode: 'Single', shippingAddress: { streetName: '1 Prince St', lastName: 'Lopez' }, shippingMethod: { key: 'mcf-collect' } });
  });
  it('complete-per-group: a delivery-only bag is a clone that leaves the address and method to the hosted flow', async () => {
    h.view = viewCart([shipLine]);
    h.raw = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 's1', sku: 'B' })] });
    const r = await preparePayments(session, market, { pickupName: null }, perGroup);
    expect(r.payCartIds).toHaveLength(1);
    expect(r.payments[0]?.clusterKey).toBe('delivery');
    expect((h.created[0] as { shippingMethod?: unknown }).shippingMethod).toBeUndefined();
  });
  it('a mixed bag is cloned into one Single cart per group and the bag is untouched', async () => {
    h.view = viewCart([collectLine, shipLine, viewLine({ id: 'u1', fulfilment: 'subscribe' })]);
    h.raw = rawMixed();
    const r = await preparePayments(session, market, { pickupName: 'Maya Lopez' }, perGroup);
    expect(h.posted).toHaveLength(0);
    expect(r.payCartIds).toHaveLength(2);
    expect(r.payments.map((p) => p.clusterKey)).toEqual(['collect:mcf-store-nyc-soho', 'delivery']);
    const [collect, delivery] = h.created as { shippingMode: string; lineItems: { sku: string; recurrenceInfo?: unknown }[]; discountCodes?: string[]; shippingMethod?: { key: string } }[];
    expect(collect?.shippingMode).toBe('Single');
    expect(collect?.lineItems.map((l) => l.sku)).toEqual(['A']);
    expect(collect?.shippingMethod?.key).toBe('mcf-collect');
    expect(collect?.discountCodes).toEqual(['WELCOME10']);
    expect(delivery?.lineItems.map((l) => l.sku)).toEqual(['B', 'C']);
    expect(delivery?.lineItems[1]?.recurrenceInfo).toBeDefined();
    expect(delivery?.discountCodes).toBeUndefined();
    expect(delivery?.shippingMethod).toBeUndefined();
  });
  it('a bag of coffee and drinks is one delivery payment (one shipment) and the clone keeps each line brand and the drinks channel', async () => {
    const drinksView = viewLine({ id: 'd1', brand: 'malva-drinks' });
    h.view = viewCart([collectLine, shipLine, drinksView]);
    h.raw = ctCart({
      anonymousId: 'anon',
      lines: [
        ctLine({ id: 'c1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' }),
        ctLine({ id: 's1', sku: 'B' }),
        ctLine({ id: 'd1', sku: 'D', channelId: 'ch-drinks', custom: { brand: 'malva-drinks' } }),
      ],
    });
    const r = await preparePayments(session, market, { pickupName: 'Maya Lopez' }, perGroup);
    expect(r.payments.map((p) => p.clusterKey)).toEqual(['collect:mcf-store-nyc-soho', 'delivery']);
    const delivery = (h.created as { lineItems: { sku: string; supplyChannel?: unknown; custom?: { fields: Record<string, string> } }[] }[])[1];
    expect(delivery?.lineItems.map((l) => l.sku)).toEqual(['B', 'D']);
    const drinks = delivery?.lineItems[1];
    expect(drinks?.supplyChannel).toEqual({ typeId: 'channel', id: 'ch-drinks' });
    expect(drinks?.custom?.fields).toMatchObject({ fulfilment: 'delivery', brand: 'malva-drinks' });
  });
  it('In-store: every clone of a mixed bag carries the order type; the website never sets it (D-042)', async () => {
    h.view = viewCart([collectLine, shipLine]);
    h.raw = rawMixed();
    vi.stubEnv('APP_MODE', 'instore');
    resetOrderTypeCache();
    await preparePayments(session, market, { pickupName: 'Maya Lopez' }, perGroup);
    expect(h.created).toHaveLength(2);
    for (const c of h.created as { custom?: unknown }[]) {
      expect(c.custom).toEqual({ type: { typeId: 'type', key: 'instore-order-type' }, fields: { orderType: 'in-store-purchase' } });
    }
    h.created = [];
    vi.stubEnv('APP_MODE', 'website');
    await preparePayments(session, market, { pickupName: 'Maya Lopez' }, perGroup);
    for (const c of h.created as { custom?: unknown }[]) expect(c.custom).toBeUndefined();
    vi.unstubAllEnvs();
  });
  it('Canada session never gets mcf-collect', async () => {
    h.view = viewCart([viewLine({ id: 'c1', fulfilment: 'collect', store: STORE_SOHO })], { country: 'CA', currency: 'CAD' });
    h.raw = ctCart({ lines: [ctLine({ id: 'c1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' })], currency: 'CAD', country: 'CA' });
    await expect(preparePayments(session, { country: 'CA', currency: 'CAD', locale: 'en-CA' }, { pickupName: 'Maya Lopez' }, perGroup)).rejects.toBeInstanceOf(CheckoutNotReady);
    expect(h.posted).toHaveLength(0);
    expect(h.created).toHaveLength(0);
  });
  it('a missing pickup name stops before any write', async () => {
    h.view = viewCart([collectLine, shipLine]);
    h.raw = rawMixed();
    await expect(preparePayments(session, market, { pickupName: null })).rejects.toMatchObject({ missing: ['pickup'] });
    expect(h.created).toHaveLength(0);
  });
});

describe('isCollectReady', () => {
  const entry = (shippingKey: string, address: object) => ({ shippingKey, shippingAddress: address, shippingInfo: {} });
  const named = { additionalAddressInfo: 'Collection at SoHo', firstName: 'Maya', lastName: 'Lopez' };
  const line = (id: string, quantity: number, key: string) => ({ id, quantity, shippingDetails: { targets: [{ addressKey: key, quantity, shippingMethodKey: key }] } });
  const multi = (over: object = {}) => ({ shippingMode: 'Multiple', shipping: [entry('collect-soho', named), entry('delivery', { country: 'US' })], lineItems: [line('a', 2, 'collect-soho'), line('b', 1, 'delivery')], ...over }) as never;

  it('a Multiple cart is ready when every store entry has the pickup name and every unit is allocated', () => {
    expect(isCollectReady(multi())).toBe(true);
  });
  it('a one-word pickup name counts (it becomes the last name)', () => {
    expect(isCollectReady(multi({ shipping: [entry('collect-soho', { additionalAddressInfo: 'Collection at SoHo', lastName: 'Maya' }), entry('delivery', { country: 'US' })] }))).toBe(true);
  });
  it('is not ready before the pickup name is written, or when a line is only partly allocated', () => {
    expect(isCollectReady(multi({ shipping: [entry('collect-soho', { additionalAddressInfo: 'Collection at SoHo' }), entry('delivery', { country: 'US' })] }))).toBe(false);
    expect(isCollectReady(multi({ lineItems: [line('a', 1, 'collect-soho'), { ...line('a', 2, 'collect-soho'), quantity: 3 }] }))).toBe(false);
    expect(isCollectReady(multi({ shipping: [] }))).toBe(false);
  });
  it('a Single clone is ready when the store is its shipping address', () => {
    expect(isCollectReady({ shippingMode: 'Single', shippingAddress: { additionalAddressInfo: 'Collection at SoHo' } } as never)).toBe(true);
    expect(isCollectReady({ shippingMode: 'Single', shippingAddress: { country: 'US' } } as never)).toBe(false);
  });
});

describe('complete-per-group', () => {
  it('Second payment failure leaves the first order intact: paying the first part removes only its lines from the bag', async () => {
    h.raw = rawMixed();
    h.byId['clone-a'] = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 'x1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' })] });
    await removePaidLines(session, 'clone-a');
    const actions = (h.posted[0]?.body as { actions: { action: string; lineItemId: string }[] }).actions;
    expect(actions).toEqual([{ action: 'removeLineItem', lineItemId: 'c1' }]);
  });
  it('a clone of somebody else never removes anything', async () => {
    h.raw = rawMixed();
    h.byId['clone-z'] = ctCart({ anonymousId: 'another-shopper', lines: [ctLine({ id: 'x1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' })] });
    await removePaidLines(session, 'clone-z');
    expect(h.posted).toHaveLength(0);
  });
  it('Every line stays in its group: no line is in two payment carts', async () => {
    h.view = viewCart([collectLine, shipLine, viewLine({ id: 'u1', fulfilment: 'subscribe' })]);
    h.raw = rawMixed();
    await preparePayments(session, market, { pickupName: 'Maya Lopez' }, perGroup);
    const skus = (h.created as { lineItems: { sku: string }[] }[]).flatMap((c) => c.lineItems.map((l) => l.sku));
    expect([...skus].sort()).toEqual(['A', 'B', 'C']);
  });
});
