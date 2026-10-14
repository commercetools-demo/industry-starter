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

const ctx: AddLineContext = {
  storeKey: 'mau-reseller-north',
  locale: 'de-DE',
  currency: 'EUR',
  country: 'DE',
  scope: { branchKey: 'mau-br-north-berlin', branchChannelId: 'ch-branch', retailChannelId: 'ch-retail' },
};
const money = (cent: number) => ({ type: 'centPrecision', currencyCode: 'EUR', centAmount: cent, fractionDigits: 2 });
const sp = (cent: number, channel?: string) => ({ id: `p${cent}`, sku: 'SKU-1', value: money(cent), active: true, country: 'DE', ...(channel ? { channel: { typeId: 'channel', id: channel } } : {}) });
const cart = (version: number, quantities: number[] = []) => ({ id: 'cart-1', version, totalPrice: { currencyCode: 'EUR' }, cartState: 'Active', lineItems: quantities.map((quantity) => ({ quantity })) });
const actionsOf = (n = 0) => cartUpdate.mock.calls[n][0].body.actions[0] as Record<string, unknown>;

beforeEach(() => {
  for (const m of [cartGet, cartCreate, cartUpdate, projectionsGet, pricesGet, inventoryGet]) m.mockReset();
  projectionsGet.mockResolvedValue({ body: { results: [{ id: 'prod-1' }] } });
  pricesGet.mockResolvedValue({ body: { results: [sp(1000)] } });
  inventoryGet.mockResolvedValue({ body: { results: [] } });
  cartCreate.mockResolvedValue({ body: cart(1) });
  cartUpdate.mockResolvedValue({ body: cart(2, [1]) });
});

describe('Add to cart from a card: lib/ct/cart addLineToCart', () => {
  it('creates a cart when none exists', async () => {
    const out = await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(cartCreate).toHaveBeenCalledTimes(1);
    const body = cartCreate.mock.calls[0][0].body;
    expect(body).toMatchObject({ currency: 'EUR', country: 'DE', locale: 'de-DE', shippingAddress: { country: 'DE' }, deleteDaysAfterLastModification: 30 });
    expect(body.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.customerId).toBeUndefined();
    expect(out).toMatchObject({ cartId: 'cart-1', count: 1, anonymousId: body.anonymousId });
  });

  it('keeps the session anonymous id and does not rotate it', async () => {
    await addLineToCart(ctx, { anonymousId: 'anon-1' }, { sku: 'SKU-1', quantity: 1 });
    expect(cartCreate.mock.calls[0][0].body.anonymousId).toBe('anon-1');
  });

  it('a signed-in shopper gets a customer cart', async () => {
    const out = await addLineToCart(ctx, { customerId: 'cust-1' }, { sku: 'SKU-1', quantity: 1 });
    const body = cartCreate.mock.calls[0][0].body;
    expect(body.customerId).toBe('cust-1');
    expect(body.anonymousId).toBeUndefined();
    expect(out.anonymousId).toBeUndefined();
  });

  it('reuses the cart of the session', async () => {
    cartGet.mockResolvedValue({ body: cart(5, [2]) });
    const out = await addLineToCart(ctx, { cartId: 'cart-1' }, { sku: 'SKU-1', quantity: 1 });
    expect(cartCreate).not.toHaveBeenCalled();
    expect(cartUpdate.mock.calls[0][0].body.version).toBe(5);
    expect(out.cartId).toBe('cart-1');
  });

  it('creates a new cart when the stored one is gone or no longer active', async () => {
    cartGet.mockRejectedValueOnce({ statusCode: 404 });
    await addLineToCart(ctx, { cartId: 'gone' }, { sku: 'SKU-1', quantity: 1 });
    expect(cartCreate).toHaveBeenCalledTimes(1);
    cartCreate.mockClear();
    cartGet.mockResolvedValueOnce({ body: { ...cart(3), cartState: 'Ordered' } });
    await addLineToCart(ctx, { cartId: 'old' }, { sku: 'SKU-1', quantity: 1 });
    expect(cartCreate).toHaveBeenCalledTimes(1);
  });

  it('adds quantity 3 as one line', async () => {
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 3 });
    expect(cartUpdate).toHaveBeenCalledTimes(1);
    expect(actionsOf()).toMatchObject({ action: 'addLineItem', sku: 'SKU-1', quantity: 3 });
  });

  it('distribution channel is the channel of the selected price (branch, retail, or none)', async () => {
    pricesGet.mockResolvedValue({ body: { results: [sp(1000), sp(900, 'ch-retail'), sp(800, 'ch-branch')] } });
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionsOf(0).distributionChannel).toEqual({ typeId: 'channel', id: 'ch-branch' });

    pricesGet.mockResolvedValue({ body: { results: [sp(1000), sp(900, 'ch-retail')] } });
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionsOf(1).distributionChannel).toEqual({ typeId: 'channel', id: 'ch-retail' });

    pricesGet.mockResolvedValue({ body: { results: [sp(1000)] } });
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionsOf(2).distributionChannel).toBeUndefined();
  });

  it('supply channel only when branch has stock', async () => {
    inventoryGet.mockResolvedValue({ body: { results: [{ availableQuantity: 5 }] } });
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 5 });
    expect(actionsOf(0).supplyChannel).toEqual({ typeId: 'channel', id: 'ch-branch' });
    expect(inventoryGet.mock.calls[0][0].queryArgs.where).toBe('sku="SKU-1" and supplyChannel(id="ch-branch")');

    inventoryGet.mockResolvedValue({ body: { results: [{ availableQuantity: 2 }] } });
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 3 });
    expect(actionsOf(1).supplyChannel).toBeUndefined();

    inventoryGet.mockResolvedValue({ body: { results: [] } });
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionsOf(2).supplyChannel).toBeUndefined();
  });

  it('retries once on 409 with the new cart version', async () => {
    cartGet.mockResolvedValueOnce({ body: cart(5) }).mockResolvedValueOnce({ body: cart(6) });
    cartUpdate.mockRejectedValueOnce({ statusCode: 409 }).mockResolvedValueOnce({ body: cart(7, [1]) });
    const out = await addLineToCart(ctx, { cartId: 'cart-1' }, { sku: 'SKU-1', quantity: 1 });
    expect(cartUpdate).toHaveBeenCalledTimes(2);
    expect(cartUpdate.mock.calls[0][0].body.version).toBe(5);
    expect(cartUpdate.mock.calls[1][0].body.version).toBe(6);
    expect(out.count).toBe(1);
  });

  it('a second 409 is reported', async () => {
    cartGet.mockResolvedValue({ body: cart(5) });
    cartUpdate.mockRejectedValue({ statusCode: 409 });
    await expect(addLineToCart(ctx, { cartId: 'cart-1' }, { sku: 'SKU-1', quantity: 1 })).rejects.toMatchObject({ statusCode: 409 });
    expect(cartUpdate).toHaveBeenCalledTimes(2);
  });

  it('maps MissingPrice to 422 price-unavailable', async () => {
    cartUpdate.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'MissingPrice' }] } });
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 })).rejects.toMatchObject({ status: 422, message: 'price-unavailable' });
  });

  it('no standalone price for the shopper is 422 without touching the cart', async () => {
    pricesGet.mockResolvedValue({ body: { results: [] } });
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 })).rejects.toMatchObject({ status: 422, message: 'price-unavailable' });
    expect(cartCreate).not.toHaveBeenCalled();
  });

  it('a sku outside the store assortment is 404', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [] } });
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 })).rejects.toMatchObject({ status: 404 });
    expect(projectionsGet.mock.calls[0][0].queryArgs).toMatchObject({ storeProjection: 'mau-reseller-north', where: 'masterVariant(sku="SKU-1")' });
    expect(cartCreate).not.toHaveBeenCalled();
  });

  it('refuses a sku that could break a predicate', async () => {
    await expect(addLineToCart(ctx, {}, { sku: 'a") or (', quantity: 1 })).rejects.toMatchObject({ status: 400 });
    expect(projectionsGet).not.toHaveBeenCalled();
  });

  it('counts units, not lines', async () => {
    cartUpdate.mockResolvedValue({ body: cart(9, [2, 3]) });
    expect((await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 })).count).toBe(5);
  });
});
