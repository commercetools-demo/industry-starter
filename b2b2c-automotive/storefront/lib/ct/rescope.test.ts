// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart, lineItem } from '@/test/cart-fixtures';

const cartGet = vi.hoisted(() => vi.fn());
const cartUpdate = vi.hoisted(() => vi.fn());
const pricesGet = vi.hoisted(() => vi.fn());
const inventoryGet = vi.hoisted(() => vi.fn());
const storeGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    inStoreKeyWithStoreKeyValue: () => ({
      carts: () => ({ withId: () => ({ get: () => ({ execute: cartGet }), post: (args: unknown) => ({ execute: () => cartUpdate(args) }) }) }),
    }),
    standalonePrices: () => ({ get: (args: unknown) => ({ execute: () => pricesGet(args) }) }),
    inventory: () => ({ get: (args: unknown) => ({ execute: () => inventoryGet(args) }) }),
  },
  projectKey: 'p',
}));
vi.mock('./shell', () => ({ getShellContext: storeGet }));

import { rescopeCart, rescopeCartToBranch } from './cart';

const money = (cent: number) => ({ type: 'centPrecision', currencyCode: 'EUR', centAmount: cent, fractionDigits: 2 });
const price = (sku: string, cent: number, channel?: string) => ({ id: `${sku}-${cent}`, sku, value: money(cent), active: true, ...(channel ? { channel: { typeId: 'channel', id: channel } } : {}) });
const scope = { branchKey: 'mau-br-north-hamburg', branchChannelId: 'ch-new', retailChannelId: 'ch-retail' };
const actions = () => cartUpdate.mock.calls[0][0].body.actions as Record<string, unknown>[];

const cartOnOldBranch = (extra: Record<string, unknown> = {}) =>
  ctCart({
    lineItems: [
      lineItem('li-1', 'BRK-1', 2, { list: 5000, supplyChannel: 'ch-old', distributionChannel: 'ch-old' }),
      lineItem('li-2', 'FLT-1', 1, { list: 1000, supplyChannel: 'ch-old', recurrence: true }),
    ],
    ...extra,
  });

beforeEach(() => {
  for (const m of [cartGet, cartUpdate, pricesGet, inventoryGet, storeGet]) m.mockReset();
  cartGet.mockResolvedValue({ body: cartOnOldBranch() });
  cartUpdate.mockResolvedValue({ body: cartOnOldBranch() });
  pricesGet.mockResolvedValue({ body: { results: [price('BRK-1', 4800, 'ch-new'), price('BRK-1', 5000), price('FLT-1', 1000)] } });
  inventoryGet.mockResolvedValue({
    body: {
      results: [
        { sku: 'BRK-1', availableQuantity: 5, supplyChannel: { typeId: 'channel', id: 'ch-new' } },
        { sku: 'FLT-1', availableQuantity: 9, supplyChannel: { typeId: 'channel', id: 'ch-new' } },
      ],
    },
  });
  storeGet.mockResolvedValue({ branches: [{ key: 'mau-br-north-hamburg', channelId: 'ch-new', address: { street: 'Hafenstraße 2', postalCode: '20095', city: 'Hamburg' } }] });
});

describe('rescopeCartToBranch', () => {
  it('every line points at the new branch supply channel and the selected price channel', async () => {
    expect(await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope)).toBe(true);
    expect(actions()).toContainEqual({ action: 'setLineItemDistributionChannel', lineItemId: 'li-1', distributionChannel: { typeId: 'channel', id: 'ch-new' } });
    expect(actions()).toContainEqual({ action: 'setLineItemSupplyChannel', lineItemId: 'li-1', supplyChannel: { typeId: 'channel', id: 'ch-new' } });
    expect(actions()).toContainEqual({ action: 'setLineItemSupplyChannel', lineItemId: 'li-2', supplyChannel: { typeId: 'channel', id: 'ch-new' } });
  });
  it('distribution channel is removed when the base price wins', async () => {
    pricesGet.mockResolvedValue({ body: { results: [price('BRK-1', 5000), price('FLT-1', 1000)] } });
    await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope);
    expect(actions()).toContainEqual({ action: 'setLineItemDistributionChannel', lineItemId: 'li-1' });
  });
  it('supply channel dropped when the new branch has no stock', async () => {
    inventoryGet.mockResolvedValue({ body: { results: [{ sku: 'BRK-1', availableQuantity: 1, supplyChannel: { typeId: 'channel', id: 'ch-new' } }] } });
    await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope);
    expect(actions()).toContainEqual({ action: 'setLineItemSupplyChannel', lineItemId: 'li-1' });
  });
  it('recalculate follows the update', async () => {
    await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope);
    expect(actions().at(-1)).toEqual({ action: 'recalculate', updateProductData: true });
  });
  it('pickup address and branch key follow the branch', async () => {
    await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope);
    expect(actions()).toContainEqual({ action: 'setShippingAddress', address: { country: 'DE', city: 'Hamburg', postalCode: '20095', streetName: 'Hafenstraße 2' } });
    expect(actions()).toContainEqual({ action: 'setCustomField', name: 'pickupBranchKey', value: 'mau-br-north-hamburg' });
  });
  it('a ship cart keeps its address', async () => {
    cartGet.mockResolvedValue({ body: cartOnOldBranch({ custom: undefined }) });
    await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope);
    expect(actions().some((a) => a.action === 'setShippingAddress')).toBe(false);
  });
  it('subscription lines keep their recurrence', async () => {
    await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope);
    expect(actions().some((a) => a.action === 'setLineItemRecurrenceInfo' || 'recurrenceInfo' in a)).toBe(false);
    expect(actions().some((a) => a.action === 'removeLineItem')).toBe(false);
  });
  it('unpriced line is reported and not dropped', async () => {
    pricesGet.mockResolvedValue({ body: { results: [price('BRK-1', 4800, 'ch-new')] } });
    const result = await rescopeCart('mau-reseller-north', 'cart-1', scope);
    expect(result.unpriced).toEqual(['FLT-1']);
    expect(actions().some((a) => a.action === 'removeLineItem' && a.lineItemId === 'li-2')).toBe(false);
    expect(actions().some((a) => a.lineItemId === 'li-2')).toBe(false);
  });
  it('no call when all lines already match', async () => {
    cartGet.mockResolvedValue({
      body: ctCart({
        lineItems: [lineItem('li-1', 'BRK-1', 2, { list: 5000, supplyChannel: 'ch-new', distributionChannel: 'ch-new' }), lineItem('li-2', 'FLT-1', 1, { list: 1000, supplyChannel: 'ch-new' })],
        custom: { type: { typeId: 'type', id: 't' }, fields: { pickupBranchKey: 'mau-br-north-hamburg' } },
      }),
    });
    expect(await rescopeCartToBranch('mau-reseller-north', 'cart-1', scope)).toBe(false);
    expect(cartUpdate).not.toHaveBeenCalled();
  });
});
