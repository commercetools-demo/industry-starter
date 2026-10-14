// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cartGet = vi.hoisted(() => vi.fn());
const cartCreate = vi.hoisted(() => vi.fn());
const cartUpdate = vi.hoisted(() => vi.fn());
const projectionsGet = vi.hoisted(() => vi.fn());
const pricesGet = vi.hoisted(() => vi.fn());
const inventoryGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    inStoreKeyWithStoreKeyValue: () => ({
      carts: () => ({
        post: (args: unknown) => ({ execute: () => cartCreate(args) }),
        withId: () => ({ get: () => ({ execute: () => cartGet() }), post: (args: unknown) => ({ execute: () => cartUpdate(args) }) }),
      }),
    }),
    productProjections: () => ({ get: (args: unknown) => ({ execute: () => projectionsGet(args) }) }),
    standalonePrices: () => ({ get: (args: unknown) => ({ execute: () => pricesGet(args) }) }),
    inventory: () => ({ get: (args: unknown) => ({ execute: () => inventoryGet(args) }) }),
  },
  projectKey: 'p',
}));

import { addLineToCart, type AddLineContext } from './cart';

const ctx: AddLineContext = { storeKey: 'mau-reseller-north', locale: 'de-DE', currency: 'EUR', country: 'DE', scope: { branchKey: 'b', branchChannelId: 'ch-branch', retailChannelId: 'ch-retail' } };
const money = (cent: number) => ({ type: 'centPrecision', currencyCode: 'EUR', centAmount: cent, fractionDigits: 2 });
const bundleProduct = {
  id: 'prod-b',
  masterVariant: { sku: 'BND-1', attributes: [{ name: 'component-skus', value: ['SK-1', 'SK-2'] }, { name: 'component-quantities', value: ['SK-1:2', 'SK-2:1'] }] },
};
const part = (sku: string) => ({ id: `p-${sku}`, name: { 'de-DE': sku }, masterVariant: { sku } });
const line = (id: string, sku: string, quantity: number, parent?: string) => ({ id, quantity, variant: { sku }, ...(parent ? { custom: { fields: { parentLineItemId: parent } } } : {}) });
const cart = (version: number, lines: unknown[] = []) => ({ id: 'cart-1', version, totalPrice: { currencyCode: 'EUR' }, cartState: 'Active', lineItems: lines });
const stockFor = (entries: [string, number][]) => ({ body: { results: entries.map(([sku, availableQuantity]) => ({ sku, availableQuantity, supplyChannel: { key: 'mau-supply-malva-dc' } })) } });
const actions = (n: number) => cartUpdate.mock.calls[n][0].body.actions as Record<string, unknown>[];

beforeEach(() => {
  for (const m of [cartGet, cartCreate, cartUpdate, projectionsGet, pricesGet, inventoryGet]) m.mockReset();
  projectionsGet.mockImplementation(async (args: { queryArgs: { where: string } }) => (args.queryArgs.where.includes('sku="BND-1"') ? { body: { results: [bundleProduct] } } : { body: { results: [part('SK-1'), part('SK-2')] } }));
  pricesGet.mockResolvedValue({ body: { results: [{ id: 'p1', sku: 'BND-1', value: money(15156), active: true, country: 'DE', channel: { typeId: 'channel', id: 'ch-retail' } }] } });
  inventoryGet.mockImplementation(async (args: { queryArgs: { where: string } }) => (args.queryArgs.where.startsWith('sku in') ? stockFor([['SK-1', 10], ['SK-2', 10]]) : { body: { results: [] } }));
  cartCreate.mockResolvedValue({ body: cart(1) });
});

describe('Add a bundle: parent line and locked child lines (W-11)', () => {
  it('adds the parent at its standalone price, then all child lines in one update', async () => {
    cartCreate.mockResolvedValue({ body: cart(1) });
    cartUpdate.mockResolvedValueOnce({ body: cart(2, [line('parent-1', 'BND-1', 2)]) }).mockResolvedValueOnce({ body: cart(3, [line('parent-1', 'BND-1', 2), line('k1', 'SK-1', 4, 'parent-1'), line('k2', 'SK-2', 2, 'parent-1')]) });
    const out = await addLineToCart(ctx, {}, { sku: 'BND-1', quantity: 2 });
    expect(actions(0)).toEqual([expect.objectContaining({ action: 'addLineItem', sku: 'BND-1', quantity: 2, distributionChannel: { typeId: 'channel', id: 'ch-retail' } })]);
    expect(actions(1)).toEqual([
      { action: 'addLineItem', sku: 'SK-1', quantity: 4, externalPrice: { currencyCode: 'EUR', centAmount: 0 }, custom: { type: { typeId: 'type', key: 'malva-line' }, fields: { parentLineItemId: 'parent-1' } } },
      { action: 'addLineItem', sku: 'SK-2', quantity: 2, externalPrice: { currencyCode: 'EUR', centAmount: 0 }, custom: { type: { typeId: 'type', key: 'malva-line' }, fields: { parentLineItemId: 'parent-1' } } },
    ]);
    expect(cartUpdate).toHaveBeenCalledTimes(2);
    // the header count is bundles, not component units
    expect(out.count).toBe(2);
  });
  it('a bundle with a component outside the store is refused, nothing is added', async () => {
    projectionsGet.mockImplementation(async (args: { queryArgs: { where: string } }) => (args.queryArgs.where.includes('sku="BND-1"') ? { body: { results: [bundleProduct] } } : { body: { results: [part('SK-1')] } }));
    await expect(addLineToCart(ctx, {}, { sku: 'BND-1', quantity: 1 })).rejects.toMatchObject({ status: 422, message: 'bundle-unavailable' });
    expect(cartUpdate).not.toHaveBeenCalled();
  });
  it('more bundles than the stock allows is refused, counting the ones already in the cart', async () => {
    inventoryGet.mockImplementation(async (args: { queryArgs: { where: string } }) => (args.queryArgs.where.startsWith('sku in') ? stockFor([['SK-1', 6], ['SK-2', 10]]) : { body: { results: [] } })); // 3 bundles
    cartGet.mockResolvedValue({ body: cart(4, [line('parent-1', 'BND-1', 2), line('k1', 'SK-1', 4, 'parent-1'), line('k2', 'SK-2', 2, 'parent-1')]) });
    await expect(addLineToCart(ctx, { cartId: 'cart-1' }, { sku: 'BND-1', quantity: 2 })).rejects.toMatchObject({ status: 422, message: 'bundle-unavailable' });
    expect(cartUpdate).not.toHaveBeenCalled();
  });
  it('a bundle cannot be a subscription', async () => {
    await expect(addLineToCart(ctx, {}, { sku: 'BND-1', quantity: 1, recurrencePolicyKey: 'mau-rp-monthly' })).rejects.toMatchObject({ status: 422 });
  });
});
