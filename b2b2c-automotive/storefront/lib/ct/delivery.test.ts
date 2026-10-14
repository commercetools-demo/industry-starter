// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart, money } from '@/test/cart-fixtures';

const cartGet = vi.hoisted(() => vi.fn());
const cartPost = vi.hoisted(() => vi.fn());
const matching = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    inStoreKeyWithStoreKeyValue: () => ({
      carts: () => ({ withId: () => ({ get: () => ({ execute: cartGet }), post: (args: unknown) => ({ execute: () => cartPost(args) }) }) }),
    }),
    shippingMethods: () => ({ matchingCart: () => ({ get: (args: unknown) => ({ execute: () => matching(args) }) }) }),
  },
  projectKey: 'p',
}));

import { getDeliveryOptions, setDelivery } from './delivery';

const branch = { key: 'mau-br-north-berlin', name: 'Malva Berlin', city: 'Berlin', pickupPromise: 'today' as const };
const method = (key: string, price: number, freeAbove?: number, currency = 'EUR') => ({
  id: `sm-${key}`,
  key,
  zoneRates: [{ shippingRates: [{ price: money(price, currency), ...(freeAbove ? { freeAbove: money(freeAbove, currency) } : {}), isMatching: true }] }],
});

beforeEach(() => {
  for (const m of [cartGet, cartPost, matching]) m.mockReset();
  cartGet.mockResolvedValue({ body: ctCart() });
  cartPost.mockResolvedValue({ body: ctCart() });
});

describe('getDeliveryOptions', () => {
  const methods = [method('mau-ship-pickup', 0), method('mau-ship-standard', 590, 15000), method('mau-ship-express', 1290)];
  it('pickup is free and names store city and time', async () => {
    matching.mockResolvedValue({ body: { results: methods } });
    const options = await getDeliveryOptions(ctCart(), branch);
    const pickup = options.find((o) => o.mode === 'pickup');
    expect(pickup).toMatchObject({ methodKey: 'mau-ship-pickup', fee: { centAmount: 0 }, branch: { name: 'Malva Berlin', city: 'Berlin', pickupPromise: 'today' } });
    expect(options.map((o) => o.methodKey)).toEqual(['mau-ship-pickup', 'mau-ship-standard']);
  });
  it('ship below threshold adds fee and reports remaining', async () => {
    matching.mockResolvedValue({ body: { results: methods } });
    // line totals 9200 + 950 = 10150
    const ship = (await getDeliveryOptions(ctCart(), branch)).find((o) => o.mode === 'ship');
    expect(ship?.fee.centAmount).toBe(590);
    expect(ship?.freeAbove?.centAmount).toBe(15000);
    expect(ship?.remainingForFree?.centAmount).toBe(15000 - 10150);
  });
  it('ship at or above threshold is free', async () => {
    matching.mockResolvedValue({ body: { results: [method('mau-ship-standard', 590, 10000)] } });
    const ship = (await getDeliveryOptions(ctCart(), branch)).find((o) => o.mode === 'ship');
    expect(ship?.fee.centAmount).toBe(0);
    expect(ship?.remainingForFree).toBeNull();
  });
  it('method without rate in cart currency is dropped', async () => {
    matching.mockResolvedValue({ body: { results: [method('mau-ship-standard', 990, 17500, 'USD'), method('mau-ship-pickup', 0)] } });
    expect((await getDeliveryOptions(ctCart(), branch)).map((o) => o.methodKey)).toEqual(['mau-ship-pickup']);
  });
  it('no matching methods yields empty options', async () => {
    matching.mockResolvedValue({ body: { results: [] } });
    expect(await getDeliveryOptions(ctCart(), branch)).toEqual([]);
  });
  it('pickup is dropped without a branch', async () => {
    matching.mockResolvedValue({ body: { results: methods } });
    expect((await getDeliveryOptions(ctCart(), null)).map((o) => o.mode)).toEqual(['ship']);
  });
});

describe('setDelivery', () => {
  const place = { key: 'mau-br-north-berlin', address: { street: 'Torstraße 1', postalCode: '10119', city: 'Berlin' } };
  const actions = () => cartPost.mock.calls[0][0].body.actions as Record<string, unknown>[];
  it('pickup sets the branch address as shipping address', async () => {
    await setDelivery('mau-reseller-north', 'cart-1', 'pickup', place);
    expect(actions()).toContainEqual({ action: 'setShippingAddress', address: { country: 'DE', city: 'Berlin', postalCode: '10119', streetName: 'Torstraße 1' } });
    expect(actions()).toContainEqual({ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: 'mau-ship-pickup' } });
  });
  it('pickup records the branch key in the cart custom field pickupBranchKey', async () => {
    cartGet.mockResolvedValue({ body: ctCart({ custom: undefined }) });
    await setDelivery('mau-reseller-north', 'cart-1', 'pickup', place);
    expect(actions()).toContainEqual({ action: 'setCustomType', type: { typeId: 'type', key: 'malva-checkout' }, fields: { pickupBranchKey: 'mau-br-north-berlin' } });
  });
  it('an existing custom type gets setCustomField', async () => {
    await setDelivery('mau-reseller-north', 'cart-1', 'pickup', place);
    expect(actions()).toContainEqual({ action: 'setCustomField', name: 'pickupBranchKey', value: 'mau-br-north-berlin' });
  });
  it('ship uses the standard method, a country-only address and clears the branch key', async () => {
    await setDelivery('mau-reseller-north', 'cart-1', 'ship', place);
    expect(actions()).toContainEqual({ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: 'mau-ship-standard' } });
    expect(actions()).toContainEqual({ action: 'setShippingAddress', address: { country: 'DE' } });
    expect(actions()).toContainEqual({ action: 'setCustomField', name: 'pickupBranchKey' });
  });
  it('pickup without a branch is refused', async () => {
    await expect(setDelivery('mau-reseller-north', 'cart-1', 'pickup', null)).rejects.toMatchObject({ status: 422 });
  });
});
