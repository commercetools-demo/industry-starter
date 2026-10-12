// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart } from '@/test/cart-fixtures';

const cartGet = vi.hoisted(() => vi.fn());
const cartCreate = vi.hoisted(() => vi.fn());
const cartUpdate = vi.hoisted(() => vi.fn());
const projectionsGet = vi.hoisted(() => vi.fn());
const pricesGet = vi.hoisted(() => vi.fn());
const inventoryGet = vi.hoisted(() => vi.fn());
const policyGet = vi.hoisted(() => vi.fn());
const inStoreKey = vi.hoisted(() => vi.fn());
vi.mock('./client', () => {
  inStoreKey.mockImplementation(() => ({
    carts: () => ({
      post: (args: unknown) => ({ execute: () => cartCreate(args) }),
      withId: () => ({ get: (args: unknown) => ({ execute: () => cartGet(args) }), post: (args: unknown) => ({ execute: () => cartUpdate(args) }) }),
    }),
  }));
  return {
    apiRoot: {
      inStoreKeyWithStoreKeyValue: inStoreKey,
      productProjections: () => ({ get: (args: unknown) => ({ execute: () => projectionsGet(args) }) }),
      standalonePrices: () => ({ get: (args: unknown) => ({ execute: () => pricesGet(args) }) }),
      inventory: () => ({ get: (args: unknown) => ({ execute: () => inventoryGet(args) }) }),
      recurrencePolicies: () => ({ withKey: () => ({ get: () => ({ execute: policyGet }) }) }),
    },
    projectKey: 'p',
  };
});

import { addLineToCart, createCart, getCart, recalculate, removeLine, setLineQuantity, type AddLineContext } from './cart';

const money = (cent: number) => ({ type: 'centPrecision', currencyCode: 'EUR', centAmount: cent, fractionDigits: 2 });
const ctx: AddLineContext = {
  storeKey: 'mau-reseller-north',
  locale: 'de-DE',
  currency: 'EUR',
  country: 'DE',
  scope: { branchKey: 'mau-br-north-berlin', branchChannelId: 'ch-branch', retailChannelId: 'ch-retail' },
};
const product = (attributes: Record<string, unknown> = {}) => ({
  id: 'prod-1',
  masterVariant: { id: 1, sku: 'SKU-1', attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })) },
  variants: [],
});
const actionOf = (n = 0) => cartUpdate.mock.calls[n][0].body.actions[0] as Record<string, unknown>;

beforeEach(() => {
  for (const m of [cartGet, cartCreate, cartUpdate, projectionsGet, pricesGet, inventoryGet, policyGet]) m.mockReset();
  inStoreKey.mockClear();
  projectionsGet.mockResolvedValue({ body: { results: [product({ 'recurring-eligible': true, 'fitment-keys': ['Volkswagen|Golf|2012|2019|2.0 TDI'] })] } });
  pricesGet.mockResolvedValue({ body: { results: [{ id: 'p', sku: 'SKU-1', value: money(1000), active: true }] } });
  inventoryGet.mockResolvedValue({ body: { results: [] } });
  cartCreate.mockResolvedValue({ body: ctCart({ lineItems: [] }) });
  cartUpdate.mockResolvedValue({ body: ctCart() });
  cartGet.mockResolvedValue({ body: ctCart() });
  policyGet.mockResolvedValue({ body: { key: 'mau-rp-monthly' } });
});

describe('createCart', () => {
  it('createCart sends store, currency, country from COUNTRY_CONFIG', async () => {
    await createCart({ storeKey: 'mau-reseller-north', locale: 'en-US' });
    expect(inStoreKey).toHaveBeenCalledWith({ storeKey: 'mau-reseller-north' });
    expect(cartCreate.mock.calls[0][0].body).toMatchObject({
      currency: 'USD',
      country: 'US',
      locale: 'en-US',
      shippingMode: 'Single',
      taxMode: 'Platform',
      taxRoundingMode: 'HalfEven',
      taxCalculationMode: 'LineItemLevel',
      inventoryMode: 'TrackOnly',
      deleteDaysAfterLastModification: 30,
      shippingAddress: { country: 'US' },
    });
  });
  it('createCart anonymous sets anonymousId and no customerId', async () => {
    await createCart({ storeKey: 'mau-reseller-north', locale: 'de-DE', anonymousId: 'anon-1' });
    const body = cartCreate.mock.calls[0][0].body;
    expect(body.anonymousId).toBe('anon-1');
    expect(body.customerId).toBeUndefined();
  });
  it('createCart signed-in sets customerId', async () => {
    await createCart({ storeKey: 'mau-reseller-north', locale: 'de-DE', customerId: 'c-1', customerEmail: 'a@example.com' });
    const body = cartCreate.mock.calls[0][0].body;
    expect(body).toMatchObject({ customerId: 'c-1', customerEmail: 'a@example.com' });
    expect(body.anonymousId).toBeUndefined();
  });
});

describe('getCart', () => {
  it('getCart returns null for Ordered cart', async () => {
    cartGet.mockResolvedValue({ body: ctCart({ cartState: 'Ordered' }) });
    expect(await getCart('mau-reseller-north', 'c')).toBeNull();
  });
  it('getCart returns null for a merged cart', async () => {
    cartGet.mockResolvedValue({ body: ctCart({ cartState: 'Merged' }) });
    expect(await getCart('mau-reseller-north', 'c')).toBeNull();
  });
  it('getCart returns null on 404', async () => {
    cartGet.mockRejectedValue({ statusCode: 404 });
    expect(await getCart('mau-reseller-north', 'c')).toBeNull();
  });
  it('getCart expands the discounts, the policy and the shipping method', async () => {
    await getCart('mau-reseller-north', 'c');
    const expand = cartGet.mock.calls[0][0].queryArgs.expand as string[];
    expect(expand).toContain('discountCodes[*].discountCode');
    expect(expand).toContain('lineItems[*].recurrenceInfo.recurrencePolicy');
    expect(expand).toContain('shippingInfo.shippingMethod');
  });
  it('other errors are rethrown', async () => {
    cartGet.mockRejectedValue({ statusCode: 500 });
    await expect(getCart('mau-reseller-north', 'c')).rejects.toBeDefined();
  });
});

describe('line changes', () => {
  it('setLineQuantity rejects 0', async () => {
    await expect(setLineQuantity('mau-reseller-north', 'c', 'li-1', 0)).rejects.toMatchObject({ status: 400 });
    expect(cartUpdate).not.toHaveBeenCalled();
  });
  it('setLineQuantity sends changeLineItemQuantity on the current version', async () => {
    await setLineQuantity('mau-reseller-north', 'c', 'li-1', 3);
    expect(cartUpdate.mock.calls[0][0].body).toMatchObject({ version: 4, actions: [{ action: 'changeLineItemQuantity', lineItemId: 'li-1', quantity: 3 }] });
  });
  it('removeLine sends removeLineItem', async () => {
    await removeLine('mau-reseller-north', 'c', 'li-1');
    expect(actionOf()).toEqual({ action: 'removeLineItem', lineItemId: 'li-1' });
  });
  it('recalculate sends updateProductData', async () => {
    await recalculate('mau-reseller-north', 'c');
    expect(actionOf()).toEqual({ action: 'recalculate', updateProductData: true });
  });
});

describe('addLineToCart: subscriptions and vehicle', () => {
  it('addLine sends channel references as objects', async () => {
    pricesGet.mockResolvedValue({ body: { results: [{ id: 'p', sku: 'SKU-1', value: money(900), active: true, country: 'DE', channel: { typeId: 'channel', id: 'ch-retail' } }] } });
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionOf().distributionChannel).toEqual({ typeId: 'channel', id: 'ch-retail' });
  });
  it('addLine for a recurring-eligible product sends recurrenceInfo with the policy key', async () => {
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1, recurrencePolicyKey: 'mau-rp-monthly' });
    expect(actionOf().recurrenceInfo).toEqual({ recurrencePolicy: { typeId: 'recurrence-policy', key: 'mau-rp-monthly' }, priceSelectionMode: 'Dynamic' });
  });
  it('addLine without a policy sends no recurrenceInfo (a one-time line)', async () => {
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionOf().recurrenceInfo).toBeUndefined();
  });
  it('addLine refuses a policy for a product that is not recurring-eligible', async () => {
    projectionsGet.mockResolvedValue({ body: { results: [product({ 'recurring-eligible': false })] } });
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1, recurrencePolicyKey: 'mau-rp-monthly' })).rejects.toMatchObject({ status: 422, message: 'not-subscribable' });
    expect(cartCreate).not.toHaveBeenCalled();
  });
  it('addLine refuses an unknown policy', async () => {
    policyGet.mockRejectedValue({ statusCode: 404 });
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1, recurrencePolicyKey: 'mau-rp-nope' })).rejects.toMatchObject({ status: 422, message: 'not-subscribable' });
  });
  it('addLine refuses a policy outside the offered mau-rp- family', async () => {
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1, recurrencePolicyKey: 'other' })).rejects.toMatchObject({ status: 422 });
  });
  it('one-time and subscription lines of one sku stay separate: the one-time add never carries recurrenceInfo', async () => {
    await addLineToCart(ctx, { cartId: 'c' }, { sku: 'SKU-1', quantity: 1 });
    await addLineToCart(ctx, { cartId: 'c' }, { sku: 'SKU-1', quantity: 1, recurrencePolicyKey: 'mau-rp-monthly' });
    expect(actionOf(0).recurrenceInfo).toBeUndefined();
    expect(actionOf(1).recurrenceInfo).toBeDefined();
  });
  it('subscriptions switched off refuse the subscribe option', async () => {
    vi.stubEnv('SUBSCRIPTIONS_PURCHASE_ENABLED', 'false');
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1, recurrencePolicyKey: 'mau-rp-monthly' })).rejects.toMatchObject({ status: 422 });
    vi.unstubAllEnvs();
  });
  it('distribution channel is absent for the base price', async () => {
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionOf().distributionChannel).toBeUndefined();
  });
  it('line custom malva-line carries the vehicle fitment key only with an active vehicle', async () => {
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 });
    expect(actionOf(0).custom).toBeUndefined();
    const vehicle = { fitmentKey: 'Volkswagen|Golf|2012|2019|2.0 TDI', make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' };
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1, vehicle });
    expect(actionOf(1).custom).toEqual({ type: { typeId: 'type', key: 'malva-line' }, fields: { vehicleFitmentKey: vehicle.fitmentKey, fit: 'fits' } });
  });
  it('a part that does not fit the vehicle is recorded as not-fit, never blocked', async () => {
    const vehicle = { fitmentKey: 'BMW|X5|2010|2012|3.0d', make: 'BMW', model: 'X5', year: 2011, engine: '3.0d' };
    await addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1, vehicle });
    expect((actionOf().custom as { fields: { fit: string } }).fields.fit).toBe('not-fit');
  });
  it('MissingPrice maps to price-unavailable', async () => {
    cartUpdate.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'MissingPrice' }] } });
    await expect(addLineToCart(ctx, {}, { sku: 'SKU-1', quantity: 1 })).rejects.toMatchObject({ status: 422, message: 'price-unavailable' });
  });
});

describe('No price floor (D17, owner answer Q-T03)', () => {
  it('no map floor or minimum price logic in lib/ct/cart.ts', () => {
    for (const file of ['cart.ts', 'cart-discounts.ts', 'delivery.ts', 'inventory.ts', 'cart-retry.ts', 'cart-view.ts']) {
      const text = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
      expect(text, file).not.toMatch(/map-floor|mapFloor|MAP floor|minimumPrice|priceFloor|assertAboveFloor/i);
    }
  });
});
