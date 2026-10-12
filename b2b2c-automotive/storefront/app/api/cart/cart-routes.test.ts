// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart, Session } from '@/lib/types';
import { ctCart } from '@/test/cart-fixtures';
import { makeRequest } from '@/test/request';

const state = vi.hoisted(() => ({ session: {} as Session, writes: [] as Session[] }));
const loadCartView = vi.hoisted(() => vi.fn());
const buildCartView = vi.hoisted(() => vi.fn());
const scopeOf = vi.hoisted(() => vi.fn());
const getCart = vi.hoisted(() => vi.fn());
const createCart = vi.hoisted(() => vi.fn());
const setLineQuantity = vi.hoisted(() => vi.fn());
const removeLine = vi.hoisted(() => vi.fn());
const pickupPlaceOf = vi.hoisted(() => vi.fn());
const getLineStock = vi.hoisted(() => vi.fn());
const setDelivery = vi.hoisted(() => vi.fn());
const applyPromoCode = vi.hoisted(() => vi.fn());
const removePromoCode = vi.hoisted(() => vi.fn());

vi.mock('@/lib/session', () => ({
  getSession: async () => state.session,
  getLocale: async () => ({ locale: 'de-DE', currency: 'EUR', country: 'DE' }),
  updateSession: async (patch: (s: Session) => Session) => {
    state.session = patch(state.session);
    state.writes.push(state.session);
    return state.session;
  },
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle: async () => null }));
vi.mock('@/lib/ct/cart-view', () => ({ loadCartView, buildCartView, scopeOf }));
vi.mock('@/lib/ct/cart', () => ({ getCart, createCart, setLineQuantity, removeLine, pickupPlaceOf, addLineToCart: vi.fn() }));
vi.mock('@/lib/ct/inventory', () => ({ getLineStock }));
vi.mock('@/lib/ct/delivery', () => ({ setDelivery }));
vi.mock('@/lib/ct/cart-discounts', () => ({ applyPromoCode, removePromoCode }));

const mapped = { id: 'cart-1', itemCount: 3 } as unknown as Cart;
const json = (method: string, body?: unknown) => makeRequest('/api/cart', { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = (lineItemId: string) => ({ params: Promise.resolve({ lineItemId }) });

beforeEach(() => {
  for (const m of [loadCartView, buildCartView, scopeOf, getCart, createCart, setLineQuantity, removeLine, pickupPlaceOf, getLineStock, setDelivery, applyPromoCode, removePromoCode]) m.mockReset();
  state.session = { storeKey: 'mau-reseller-north', cartId: 'cart-1', branchKey: 'mau-br-north-berlin' };
  state.writes = [];
  buildCartView.mockResolvedValue(mapped);
  scopeOf.mockResolvedValue({ scope: { branchKey: 'mau-br-north-berlin', branchChannelId: 'ch-b', retailChannelId: 'ch-r' } });
  getCart.mockResolvedValue(ctCart());
  getLineStock.mockResolvedValue(new Map([['BRK-1', { branchQty: 1, masterQty: 10 }]]));
  setLineQuantity.mockResolvedValue(ctCart());
  removeLine.mockResolvedValue(ctCart());
  pickupPlaceOf.mockResolvedValue({ key: 'mau-br-north-berlin', address: { street: 's', postalCode: 'p', city: 'c' } });
  setDelivery.mockResolvedValue(ctCart());
});

describe('GET /api/cart', () => {
  it('GET with no cart returns null', async () => {
    state.session = { storeKey: 'mau-reseller-north' };
    const { GET } = await import('./route');
    const res = await GET();
    expect(await res.json()).toEqual({ cart: null });
    expect(loadCartView).not.toHaveBeenCalled();
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
  it('GET clears stale cartId', async () => {
    loadCartView.mockResolvedValue({ cart: null, drop: true });
    const { GET } = await import('./route');
    expect(await (await GET()).json()).toEqual({ cart: null });
    expect(state.session.cartId).toBeUndefined();
    expect(state.session.storeKey).toBe('mau-reseller-north');
  });
  it('GET clears cartId of an ordered cart and of another store (the view reports drop)', async () => {
    loadCartView.mockResolvedValue({ cart: null, drop: true });
    const { GET } = await import('./route');
    await GET();
    expect(state.writes.at(-1)?.cartId).toBeUndefined();
  });
  it('GET returns the mapped cart', async () => {
    loadCartView.mockResolvedValue({ cart: mapped, drop: false });
    const { GET } = await import('./route');
    expect(await (await GET()).json()).toEqual({ cart: mapped });
    expect(state.writes).toHaveLength(0);
  });
  it('POST creates a cart and sets the session', async () => {
    state.session = { storeKey: 'mau-reseller-north' };
    createCart.mockResolvedValue({ ...ctCart(), id: 'cart-new', anonymousId: 'anon-9' });
    const { POST } = await import('./route');
    expect(await (await POST()).json()).toEqual({ cart: mapped });
    expect(state.session).toMatchObject({ cartId: 'cart-new', anonymousId: 'anon-9' });
  });
});

describe('PATCH and DELETE /api/cart/items/[lineItemId]', () => {
  it('PATCH rejects quantity 0', async () => {
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 0 }), params('li-1'));
    expect(res.status).toBe(400);
    expect(setLineQuantity).not.toHaveBeenCalled();
  });
  it('PATCH sets the quantity and answers the cart', async () => {
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 1 }), params('li-1'));
    // the line has 2 units: 1 is a change
    expect(res.status).toBe(200);
    expect(setLineQuantity).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', 'li-1', 1);
    expect(await res.json()).toEqual({ cart: mapped });
  });
  it('PATCH answers with the stock of every line, not only the changed one', async () => {
    const { PATCH } = await import('./items/[lineItemId]/route');
    await PATCH(json('PATCH', { quantity: 1 }), params('li-1'));
    // a partial stock map would read the other lines as out of stock; the view reads them all itself
    expect(buildCartView.mock.calls[0]).toHaveLength(2);
  });
  it('PATCH capped quantity returns notice', async () => {
    getLineStock.mockResolvedValue(new Map([['BRK-1', { branchQty: 1, masterQty: 2 }]]));
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 9 }), params('li-1'));
    expect(setLineQuantity).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', 'li-1', 3);
    expect(await res.json()).toEqual({ cart: mapped, notice: 'capped' });
  });
  it('PATCH with nothing in stock keeps the line and says out-of-stock', async () => {
    getLineStock.mockResolvedValue(new Map([['BRK-1', { branchQty: 0, masterQty: 0 }]]));
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 3 }), params('li-1'));
    expect(setLineQuantity).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ cart: mapped, notice: 'out-of-stock' });
  });
  it('PATCH of an unknown line is 404', async () => {
    const { PATCH } = await import('./items/[lineItemId]/route');
    expect((await PATCH(json('PATCH', { quantity: 2 }), params('nope'))).status).toBe(404);
  });
  it('PATCH without a session cart is 404', async () => {
    state.session = { storeKey: 'mau-reseller-north' };
    const { PATCH } = await import('./items/[lineItemId]/route');
    expect((await PATCH(json('PATCH', { quantity: 2 }), params('li-1'))).status).toBe(404);
  });
  it('DELETE removes line', async () => {
    const { DELETE } = await import('./items/[lineItemId]/route');
    const res = await DELETE(json('DELETE'), params('li-1'));
    expect(removeLine).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', 'li-1');
    expect(await res.json()).toEqual({ cart: mapped });
  });
  it('cart of another store is ignored: commercetools answers 404 and the id leaves the session', async () => {
    removeLine.mockRejectedValue({ statusCode: 404 });
    const { DELETE } = await import('./items/[lineItemId]/route');
    expect((await DELETE(json('DELETE'), params('li-1'))).status).toBe(404);
    expect(state.session.cartId).toBeUndefined();
  });
  it('an invalid line id is 404 without a call', async () => {
    const { DELETE } = await import('./items/[lineItemId]/route');
    expect((await DELETE(json('DELETE'), params('a/../b'))).status).toBe(404);
    expect(removeLine).not.toHaveBeenCalled();
  });
});

describe('PUT /api/cart/delivery', () => {
  it('delivery switch returns new fee and tax', async () => {
    const { PUT } = await import('./delivery/route');
    const res = await PUT(json('PUT', { mode: 'ship' }));
    expect(setDelivery).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', 'ship', expect.objectContaining({ key: 'mau-br-north-berlin' }));
    expect(await res.json()).toEqual({ cart: mapped });
  });
  it('an unknown mode is 400', async () => {
    const { PUT } = await import('./delivery/route');
    expect((await PUT(json('PUT', { mode: 'drone' }))).status).toBe(400);
  });
});

describe('/api/cart/discount-codes', () => {
  it('applying a code answers the cart and the state of the code', async () => {
    const promo = { code: 'MALVA-WELCOME5', id: 'dc-1', state: 'applied', reason: null };
    applyPromoCode.mockResolvedValue({ cart: ctCart(), promo });
    const { POST } = await import('./discount-codes/route');
    expect(await (await POST(json('POST', { code: 'MALVA-WELCOME5' }))).json()).toEqual({ cart: mapped, promo });
  });
  it('a rejected code leaves the cart unchanged and reports not-applied', async () => {
    const promo = { code: 'NONSENSE', id: '', state: 'not-applied', reason: 'not-valid' };
    applyPromoCode.mockResolvedValue({ cart: null, promo });
    const { POST } = await import('./discount-codes/route');
    const res = await POST(json('POST', { code: 'NONSENSE' }));
    expect(getCart).toHaveBeenCalled();
    expect(await res.json()).toEqual({ cart: mapped, promo });
  });
  it('DELETE removes a code', async () => {
    removePromoCode.mockResolvedValue(ctCart());
    const { DELETE } = await import('./discount-codes/route');
    await DELETE(json('DELETE', { id: 'dc-1' }));
    expect(removePromoCode).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', 'dc-1');
  });
});

describe('type boundary', () => {
  it('no route imports from @commercetools/platform-sdk types', () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));
    const root = path.resolve(import.meta.dirname, '..');
    for (const dir of ['cart', 'auth']) {
      for (const file of walk(path.join(root, dir)).filter((f) => /route\.ts$/.test(f))) {
        expect(readFileSync(file, 'utf8'), file).not.toMatch(/@commercetools\/platform-sdk/);
      }
    }
  });
});
