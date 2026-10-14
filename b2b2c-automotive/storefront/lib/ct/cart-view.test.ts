// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart, lineItem } from '@/test/cart-fixtures';

const getCart = vi.hoisted(() => vi.fn());
const loadRescopeInputs = vi.hoisted(() => vi.fn());
const pickupPlaceOf = vi.hoisted(() => vi.fn());
const postActions = vi.hoisted(() => vi.fn());
const getDeliveryOptions = vi.hoisted(() => vi.fn());
const setDelivery = vi.hoisted(() => vi.fn());
const getLineStock = vi.hoisted(() => vi.fn());
const getShellContext = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: {}, projectKey: 'p' }));
vi.mock('./cart', async () => ({ ...(await vi.importActual<object>('./cart')), getCart, loadRescopeInputs, pickupPlaceOf, postActions }));
vi.mock('./delivery', () => ({ getDeliveryOptions, setDelivery, PICKUP_BRANCH_FIELD: 'pickupBranchKey' }));
vi.mock('./inventory', () => ({ getLineStock }));
vi.mock('./shell', () => ({ getShellContext }));

import { loadCartView } from './cart-view';

const input = { storeKey: 'mau-reseller-north', locale: 'de-DE' as const, branchKey: 'mau-br-north-berlin', vehicle: null, savingFallback: 'Rabatt' };
const shell = {
  storeId: 's',
  settings: { timezone: 'Europe/Berlin', shipDays: { min: 2, max: 3 } },
  retailChannelId: 'ch-retail',
  branches: [{ key: 'mau-br-north-berlin', channelId: 'ch-branch', name: 'Malva Berlin', address: { street: 's', postalCode: 'p', city: 'Berlin' }, hours: {}, timezone: 'Europe/Berlin', pickupMode: 'next-day' }],
};
const stock = new Map([['BRK-1', { branchQty: 5, masterQty: 5 }], ['FLT-1', { branchQty: 5, masterQty: 5 }]]);

beforeEach(() => {
  for (const m of [getCart, loadRescopeInputs, pickupPlaceOf, postActions, getDeliveryOptions, setDelivery, getLineStock, getShellContext]) m.mockReset();
  getShellContext.mockResolvedValue(shell);
  getCart.mockResolvedValue(ctCart());
  loadRescopeInputs.mockResolvedValue({
    prices: new Map([['BRK-1', [{ id: 'p', centAmount: 5000, currencyCode: 'EUR', fractionDigits: 2, channelId: 'ch-retail' }]]]),
    stock,
  });
  pickupPlaceOf.mockResolvedValue({ key: 'mau-br-north-berlin', address: shell.branches[0].address });
  getDeliveryOptions.mockResolvedValue([]);
  getLineStock.mockResolvedValue(stock);
});

describe('loadCartView', () => {
  it('no cart id is no cart and nothing to clear', async () => {
    expect(await loadCartView(undefined, input)).toEqual({ cart: null, drop: false });
    expect(getCart).not.toHaveBeenCalled();
  });
  it('an ordered or missing cart is dropped from the session', async () => {
    getCart.mockResolvedValue(null);
    expect(await loadCartView('c', input)).toEqual({ cart: null, drop: true });
  });
  it('a cart of another store is treated as absent', async () => {
    getCart.mockResolvedValue(ctCart({ store: { typeId: 'store', key: 'mau-reseller-south' } }));
    expect(await loadCartView('c', input)).toEqual({ cart: null, drop: true });
  });
  it('an empty cart is mapped without a re-scope', async () => {
    getCart.mockResolvedValue(ctCart({ lineItems: [] }));
    const { cart } = await loadCartView('c', input);
    expect(cart?.itemCount).toBe(0);
    expect(loadRescopeInputs).not.toHaveBeenCalled();
  });
  it('a line on another price channel is re-scoped and the updated cart is shown', async () => {
    // fixture line 1 sits on ch-retail, the selected price is on ch-retail too; make the line sit on an old branch
    getCart.mockResolvedValue(ctCart({ lineItems: [lineItem('li-1', 'BRK-1', 2, { list: 5000, distributionChannel: 'ch-old', supplyChannel: 'ch-branch' })] }));
    postActions.mockResolvedValue(ctCart({ lineItems: [lineItem('li-1', 'BRK-1', 2, { list: 5000, distributionChannel: 'ch-retail', supplyChannel: 'ch-branch' })] }));
    const { cart } = await loadCartView('c', input);
    expect(postActions).toHaveBeenCalledTimes(1);
    expect(postActions.mock.calls[0][2].at(-1)).toEqual({ action: 'recalculate', updateProductData: true });
    expect(cart?.lines).toHaveLength(1);
  });
  it('a cart without a shipping method gets pickup at the branch', async () => {
    getCart.mockResolvedValue(ctCart({ shippingInfo: undefined, custom: undefined }));
    setDelivery.mockResolvedValue(ctCart());
    await loadCartView('c', input);
    expect(setDelivery).toHaveBeenCalledWith('mau-reseller-north', 'c', 'pickup', expect.objectContaining({ key: 'mau-br-north-berlin' }));
  });
  it('a store without branches presets shipping', async () => {
    getShellContext.mockResolvedValue({ ...shell, branches: [] });
    pickupPlaceOf.mockResolvedValue(null);
    postActions.mockResolvedValue(ctCart({ shippingInfo: undefined, custom: undefined }));
    getCart.mockResolvedValue(ctCart({ shippingInfo: undefined, custom: undefined }));
    setDelivery.mockResolvedValue(ctCart());
    await loadCartView('c', { ...input, branchKey: undefined });
    expect(setDelivery).toHaveBeenCalledWith('mau-reseller-north', 'c', 'ship', null);
  });
  it('a lost race while presetting the delivery reads the cart the other request wrote', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getCart.mockResolvedValueOnce(ctCart({ shippingInfo: undefined, custom: undefined })).mockResolvedValueOnce(ctCart());
    setDelivery.mockRejectedValue({ statusCode: 409 });
    const { cart } = await loadCartView('c', input);
    expect(cart?.delivery.selected).toBe('pickup');
  });
  it('a failing delivery lookup shows an empty option list instead of crashing the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getDeliveryOptions.mockRejectedValue({ statusCode: 403 });
    const { cart } = await loadCartView('c', input);
    expect(cart?.delivery.options).toEqual([]);
  });
  it('a failing re-scope still shows the cart', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loadRescopeInputs.mockRejectedValue({ statusCode: 500 });
    const { cart } = await loadCartView('c', input);
    expect(cart?.lines.length).toBe(2);
  });
});
