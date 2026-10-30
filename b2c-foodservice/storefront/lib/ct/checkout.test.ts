import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart, ctLine, STORE_SOHO, viewCart, viewLine } from '@/test/cart';

const h = vi.hoisted(() => ({
  view: null as unknown,
  raw: null as unknown,
  byId: {} as Record<string, unknown>,
  posted: [] as { id: string; body: unknown }[],
  created: [] as unknown[],
  conflictOnce: false,
  rebuild: vi.fn(),
}));

vi.mock('@/lib/ct/cart', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/cart')>()),
  getCartView: vi.fn(async () => ({ cart: h.view, session: {} })),
  getOwnedCartForRebuild: vi.fn(async () => h.raw),
  rebuildCart: h.rebuild,
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
import { ensureCheckoutCart, getCheckoutState, missingForPayment, preparePayments, removePaidLines, CheckoutNotReady } from './checkout';

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
  h.rebuild.mockReset();
});

describe('getCheckoutState', () => {
  it('returns every line with its group key, pickup, delivery note and codes', async () => {
    h.view = viewCart([collectLine, shipLine]);
    h.raw = rawMixed();
    const { state } = await getCheckoutState(session, market, new Date('2026-10-21T15:00:00Z'));
    expect(state?.cart.lines.map((l) => [l.id, l.groupKey])).toEqual([['c1', 'collect:mcf-store-nyc-soho'], ['s1', 'delivery']]);
    expect(state?.pickup).toMatchObject({ storeKey: 'mcf-store-nyc-soho', storeName: 'Malva SoHo', readyMinutes: 15 });
    expect(state?.deliveryNote).toEqual({ freeAboveCents: 7500, days: '2-4 business days' });
    expect(state?.strategy).toBe('complete-per-group');
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
  it('Collect-only cart in the US gets the store address and mcf-collect', async () => {
    h.view = viewCart([collectLine]);
    h.raw = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 'c1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' })] });
    const r = await preparePayments(session, market, { pickupName: 'Maya Lopez' });
    const actions = (h.posted[0]?.body as { actions: { action: string; address?: { streetName: string; lastName: string }; shippingMethod?: { key: string } }[] }).actions;
    expect(actions.map((a) => a.action)).toEqual(['setShippingAddress', 'setShippingMethod']);
    expect(actions[0]?.address).toMatchObject({ streetName: '1 Prince St', lastName: 'Lopez' });
    expect(actions[1]?.shippingMethod?.key).toBe('mcf-collect');
    expect(r.payCartIds).toEqual([]);
    expect(r.payments).toHaveLength(1);
  });
  it('Version conflict is retried once', async () => {
    h.view = viewCart([collectLine]);
    h.raw = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 'c1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' })] });
    h.conflictOnce = true;
    await preparePayments(session, market, { pickupName: 'Maya Lopez' });
    expect(h.posted).toHaveLength(1);
  });
  it('a delivery-only bag is left to the hosted flow', async () => {
    h.view = viewCart([shipLine]);
    h.raw = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 's1', sku: 'B' })] });
    const r = await preparePayments(session, market, { pickupName: null });
    expect(h.posted).toHaveLength(0);
    expect(r.payments[0]?.clusterKey).toBe('delivery');
  });
  it('a mixed bag is cloned into one Single cart per group and the bag is untouched', async () => {
    h.view = viewCart([collectLine, shipLine, viewLine({ id: 'u1', fulfilment: 'subscribe' })]);
    h.raw = rawMixed();
    const r = await preparePayments(session, market, { pickupName: 'Maya Lopez' });
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
  it('In-store: every clone of a mixed bag carries the order type; the website never sets it (D-042)', async () => {
    h.view = viewCart([collectLine, shipLine]);
    h.raw = rawMixed();
    vi.stubEnv('APP_MODE', 'instore');
    resetOrderTypeCache();
    await preparePayments(session, market, { pickupName: 'Maya Lopez' });
    expect(h.created).toHaveLength(2);
    for (const c of h.created as { custom?: unknown }[]) {
      expect(c.custom).toEqual({ type: { typeId: 'type', key: 'instore-order-type' }, fields: { orderType: 'in-store-purchase' } });
    }
    h.created = [];
    vi.stubEnv('APP_MODE', 'website');
    await preparePayments(session, market, { pickupName: 'Maya Lopez' });
    for (const c of h.created as { custom?: unknown }[]) expect(c.custom).toBeUndefined();
    vi.unstubAllEnvs();
  });
  it('Canada session never gets mcf-collect', async () => {
    h.view = viewCart([viewLine({ id: 'c1', fulfilment: 'collect', store: STORE_SOHO })], { country: 'CA', currency: 'CAD' });
    h.raw = ctCart({ lines: [ctLine({ id: 'c1', sku: 'A', fulfilment: 'collect', channelId: 'ch-soho' })], currency: 'CAD', country: 'CA' });
    await expect(preparePayments(session, { country: 'CA', currency: 'CAD', locale: 'en-CA' }, { pickupName: 'Maya Lopez' })).rejects.toBeInstanceOf(CheckoutNotReady);
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

describe('ensureCheckoutCart', () => {
  it('ensureCheckoutCart clones a Single cart into a Multiple cart when the strategy needs it', async () => {
    h.view = viewCart([collectLine, shipLine]);
    h.raw = rawMixed();
    h.rebuild.mockResolvedValue({ session: { ...session, cartId: 'multi-1' }, dropped: [], droppedCodes: [] });
    const next = await ensureCheckoutCart(session, market, 'complete-multiple');
    expect(next.cartId).toBe('multi-1');
    expect(h.rebuild).toHaveBeenCalledWith(session, h.raw, expect.objectContaining({ shippingMode: 'Multiple' }));
  });
  it('complete-per-group never changes the bag', async () => {
    h.view = viewCart([collectLine, shipLine]);
    h.raw = rawMixed();
    expect(await ensureCheckoutCart(session, market, 'complete-per-group')).toBe(session);
    expect(h.rebuild).not.toHaveBeenCalled();
  });
  it('a single group stays as it is', async () => {
    h.view = viewCart([shipLine]);
    h.raw = ctCart({ anonymousId: 'anon', lines: [ctLine({ id: 's1', sku: 'B' })] });
    expect(await ensureCheckoutCart(session, market, 'complete-multiple')).toBe(session);
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
    await preparePayments(session, market, { pickupName: 'Maya Lopez' });
    const skus = (h.created as { lineItems: { sku: string }[] }[]).flatMap((c) => c.lineItems.map((l) => l.sku));
    expect([...skus].sort()).toEqual(['A', 'B', 'C']);
  });
});
