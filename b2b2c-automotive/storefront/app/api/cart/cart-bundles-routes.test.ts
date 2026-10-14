// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import type { Cart as CtCart, LineItem } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart, Session } from '@/lib/types';
import { ctCart } from '@/test/cart-fixtures';
import { makeRequest } from '@/test/request';

const state = vi.hoisted(() => ({ session: {} as Session }));
const buildCartView = vi.hoisted(() => vi.fn());
const scopeOf = vi.hoisted(() => vi.fn());
const getCart = vi.hoisted(() => vi.fn());
const setLineQuantity = vi.hoisted(() => vi.fn());
const removeLine = vi.hoisted(() => vi.fn());
const setBundleQuantity = vi.hoisted(() => vi.fn());
const removeBundle = vi.hoisted(() => vi.fn());
const getLineStock = vi.hoisted(() => vi.fn());
const addLineToCart = vi.hoisted(() => vi.fn());

vi.mock('@/lib/session', () => ({
  getSession: async () => state.session,
  getLocale: async () => ({ locale: 'de-DE', currency: 'EUR', country: 'DE' }),
  updateSession: async (patch: (s: Session) => Session) => (state.session = patch(state.session)),
}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/vehicles/active', () => ({ getActiveVehicle: async () => null }));
vi.mock('@/lib/vehicles/service', () => ({ readGarage: async () => ({ vehicles: [], activeId: null }) }));
vi.mock('@/lib/ct/shell', () => ({ getShellContext: async () => ({ branches: [], retailChannelId: 'ch-r' }) }));
vi.mock('@/lib/ct/cart-view', () => ({ buildCartView, scopeOf }));
vi.mock('@/lib/ct/cart', () => ({ getCart, setLineQuantity, removeLine, addLineToCart }));
vi.mock('@/lib/ct/inventory', () => ({ getLineStock }));
vi.mock('@/lib/ct/cart-bundles', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/cart-bundles')>()), setBundleQuantity, removeBundle }));

const mapped = { id: 'cart-1', itemCount: 2 } as unknown as Cart;
const json = (method: string, body?: unknown) => makeRequest('/api/cart', { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = (lineItemId: string) => ({ params: Promise.resolve({ lineItemId }) });
const line = (id: string, sku: string, quantity: number, parent?: string) =>
  ({ id, quantity, variant: { sku }, ...(parent ? { custom: { fields: { parentLineItemId: parent } } } : {}) }) as unknown as LineItem;
const bundleCart = (): CtCart => ({ ...ctCart(), lineItems: [line('p', 'BND-1', 2), line('c1', 'SK-1', 4, 'p'), line('c2', 'SK-2', 2, 'p')] }) as unknown as CtCart;

beforeEach(() => {
  for (const m of [buildCartView, scopeOf, getCart, setLineQuantity, removeLine, setBundleQuantity, removeBundle, getLineStock, addLineToCart]) m.mockReset();
  state.session = { storeKey: 'mau-reseller-north', cartId: 'cart-1' };
  buildCartView.mockResolvedValue(mapped);
  scopeOf.mockResolvedValue({ scope: { branchKey: 'b', branchChannelId: 'ch-b', retailChannelId: 'ch-r' } });
  getCart.mockResolvedValue(bundleCart());
  getLineStock.mockResolvedValue(
    new Map([
      ['SK-1', { branchQty: 2, masterQty: 20 }],
      ['SK-2', { branchQty: 1, masterQty: 20 }],
    ]),
  );
  setBundleQuantity.mockResolvedValue(bundleCart());
  removeBundle.mockResolvedValue(bundleCart());
  setLineQuantity.mockResolvedValue(ctCart());
  removeLine.mockResolvedValue(ctCart());
  addLineToCart.mockResolvedValue({ cartId: 'cart-1', count: 1 });
});

describe('bundle component lines are locked (W-11)', () => {
  it('PATCH of a child is 422 BUNDLE_CHILD_LOCKED and nothing is written', async () => {
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 1 }), params('c1'));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'BUNDLE_CHILD_LOCKED' });
    for (const m of [setLineQuantity, setBundleQuantity, removeLine, removeBundle]) expect(m).not.toHaveBeenCalled();
  });
  it('DELETE of a child is 422 BUNDLE_CHILD_LOCKED', async () => {
    const { DELETE } = await import('./items/[lineItemId]/route');
    const res = await DELETE(json('DELETE'), params('c2'));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'BUNDLE_CHILD_LOCKED' });
    expect(removeLine).not.toHaveBeenCalled();
    expect(removeBundle).not.toHaveBeenCalled();
  });
  it('PATCH of the bundle line changes parent and children together', async () => {
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 3 }), params('p'));
    expect(res.status).toBe(200);
    expect(setBundleQuantity).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', 'p', 3);
    expect(setLineQuantity).not.toHaveBeenCalled();
  });
  it('PATCH of the bundle line is capped by the scarcest component (2 bundles at most) and says so', async () => {
    getLineStock.mockResolvedValue(
      new Map([
        ['SK-1', { branchQty: 1, masterQty: 3 }], // 4 / 2 per bundle = 2
        ['SK-2', { branchQty: 0, masterQty: 20 }],
      ]),
    );
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 5 }), params('p'));
    expect(setBundleQuantity).not.toHaveBeenCalled(); // 2 bundles are already in the cart
    expect(await res.json()).toEqual({ cart: mapped, notice: 'capped' });
  });
  it('PATCH of the bundle line with a component out of stock keeps it and says out-of-stock', async () => {
    getLineStock.mockResolvedValue(new Map([['SK-1', { branchQty: 0, masterQty: 0 }], ['SK-2', { branchQty: 5, masterQty: 0 }]]));
    const { PATCH } = await import('./items/[lineItemId]/route');
    const res = await PATCH(json('PATCH', { quantity: 3 }), params('p'));
    expect(await res.json()).toEqual({ cart: mapped, notice: 'out-of-stock' });
    expect(setBundleQuantity).not.toHaveBeenCalled();
  });
  it('DELETE of the bundle line removes parent and children, not just one line', async () => {
    const { DELETE } = await import('./items/[lineItemId]/route');
    expect((await DELETE(json('DELETE'), params('p'))).status).toBe(200);
    expect(removeBundle).toHaveBeenCalledWith('mau-reseller-north', 'cart-1', 'p');
    expect(removeLine).not.toHaveBeenCalled();
  });
  it('a plain line still uses the plain functions', async () => {
    getCart.mockResolvedValue({ ...ctCart(), lineItems: [line('plain', 'BRK-1', 2)] });
    getLineStock.mockResolvedValue(new Map([['BRK-1', { branchQty: 5, masterQty: 5 }]]));
    const { PATCH, DELETE } = await import('./items/[lineItemId]/route');
    await PATCH(json('PATCH', { quantity: 1 }), params('plain'));
    await DELETE(json('DELETE'), params('plain'));
    expect(setLineQuantity).toHaveBeenCalled();
    expect(removeLine).toHaveBeenCalled();
    expect(setBundleQuantity).not.toHaveBeenCalled();
    expect(removeBundle).not.toHaveBeenCalled();
  });
});

describe('request bodies never carry a price or custom fields (W-11)', () => {
  it('POST /api/cart/lines with externalPrice or custom is a 400 and adds nothing', async () => {
    const { POST } = await import('./lines/route');
    for (const extra of [{ externalPrice: { currencyCode: 'EUR', centAmount: 0 } }, { custom: { fields: { parentLineItemId: 'x' } } }, { parentLineItemId: 'x' }]) {
      const res = await POST(json('POST', { sku: 'BND-1', quantity: 1, ...extra }));
      expect(res.status).toBe(400);
    }
    expect(addLineToCart).not.toHaveBeenCalled();
  });
  it('PATCH with a price or custom field is a 400', async () => {
    const { PATCH } = await import('./items/[lineItemId]/route');
    expect((await PATCH(json('PATCH', { quantity: 1, externalPrice: { currencyCode: 'EUR', centAmount: 0 } }), params('p'))).status).toBe(400);
    expect(setBundleQuantity).not.toHaveBeenCalled();
  });
  it('a plain add still works', async () => {
    const { POST } = await import('./lines/route');
    expect((await POST(json('POST', { sku: 'BND-1', quantity: 1 }))).status).toBe(200);
    expect(addLineToCart).toHaveBeenCalled();
  });
});
