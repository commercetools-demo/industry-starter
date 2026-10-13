// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ctCart } from '@/test/cart-fixtures';

const postActions = vi.hoisted(() => vi.fn());
const withCartRetry = vi.hoisted(() => vi.fn());
const getLineStock = vi.hoisted(() => vi.fn());
const getShellContext = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/cart', () => ({ postActions }));
vi.mock('@/lib/ct/cart-retry', () => ({ withCartRetry }));
vi.mock('@/lib/ct/inventory', () => ({ getLineStock }));
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));

import { EmptyCart, LinesUnavailable, prepareCartForCheckout, SubscriptionsUnavailable } from './checkout-prepare';

const input = { storeKey: 'mau-reseller-north', cartId: 'cart-1', branchKey: 'mau-br-north-berlin', vehicleLabel: null as string | null };
const dev = { production: false, subscriptionsEnabled: true };
const prod = { production: true, subscriptionsEnabled: true };
const actionsOf = () => postActions.mock.calls[0][2] as { action: string; name?: string; value?: unknown; fields?: Record<string, unknown>; email?: string }[];
const written = () => {
  const out: Record<string, unknown> = {};
  for (const a of actionsOf()) {
    if (a.action === 'setCustomType') Object.assign(out, a.fields);
    if (a.action === 'setCustomField' && a.name) out[a.name] = a.value;
  }
  return out;
};
const noCustom = () => ({ ...ctCart(), custom: undefined });
const useCart = (cart: unknown) => withCartRetry.mockImplementation(async (_s: string, _c: string, fn: (cart: unknown) => unknown) => fn(cart));
const recurring = () => {
  const cart = ctCart();
  const lines = [...(cart.lineItems ?? [])];
  lines[0] = { ...lines[0], recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp' }, priceSelectionMode: 'Dynamic' } } as (typeof lines)[number];
  return { ...cart, lineItems: lines };
};

beforeEach(() => {
  for (const m of [postActions, withCartRetry, getLineStock, getShellContext]) m.mockReset();
  withCartRetry.mockImplementation(async (_s: string, _c: string, fn: (cart: unknown) => unknown) => fn(ctCart()));
  getShellContext.mockResolvedValue({ branches: [{ key: 'mau-br-north-berlin', channelId: 'ch-b' }], retailChannelId: 'ch-r' });
  getLineStock.mockResolvedValue(
    new Map([
      ['BRK-1', { branchQty: 5, masterQty: 0 }],
      ['FLT-1', { branchQty: 0, masterQty: 9 }],
    ]),
  );
  postActions.mockResolvedValue(ctCart());
});

describe('bundles at checkout (W-11)', () => {
  const lineOf = (id: string, sku: string, quantity: number, parent?: string) =>
    ({ ...(ctCart().lineItems?.[0] as object), id, quantity, variant: { sku }, ...(parent ? { custom: { type: { typeId: 'type', id: 't' }, fields: { parentLineItemId: parent } } } : {}) }) as never;
  const bundleCart = () => ({ ...ctCart(), lineItems: [lineOf('p', 'BND-1', 2), lineOf('c1', 'BRK-1', 4, 'p'), lineOf('c2', 'FLT-1', 2, 'p')] });
  it('a bundle line is not read as out of stock for having no inventory entry; its components are what counts', async () => {
    useCart(bundleCart());
    await expect(prepareCartForCheckout(input, dev)).resolves.toBeDefined();
    expect(getLineStock.mock.calls[0][0]).not.toContain('BND-1');
  });
  it('a component out of stock blocks the checkout and names the component line', async () => {
    useCart(bundleCart());
    getLineStock.mockResolvedValue(new Map([['BRK-1', { branchQty: 0, masterQty: 0 }], ['FLT-1', { branchQty: 0, masterQty: 9 }]]));
    await expect(prepareCartForCheckout(input, dev)).rejects.toMatchObject({ lineItemIds: ['c1'] });
  });
});

describe('placedOnBehalfBy (V-06 audit field)', () => {
  it('a shop-as session writes the seller id into the malva-checkout fields', async () => {
    useCart(noCustom());
    await prepareCartForCheckout({ ...input, placedOnBehalfBy: 'seller-1' }, dev);
    expect(written()).toMatchObject({ placedOnBehalfBy: 'seller-1', salesChannel: 'web' });
    expect(actionsOf().filter((a) => a.action === 'setCustomType')).toHaveLength(1);
  });
  it('a normal shopper never gets the field', async () => {
    useCart(noCustom());
    await prepareCartForCheckout(input, dev);
    expect(written()).not.toHaveProperty('placedOnBehalfBy');
  });
  it('the field is merged into the existing type, never a second type, and a stale value is removed when the session is not shop-as', async () => {
    const cart = { ...ctCart(), custom: { type: { typeId: 'type', id: 't' }, fields: { placedOnBehalfBy: 'seller-1', salesChannel: 'web' } } };
    useCart(cart);
    await prepareCartForCheckout(input, dev);
    expect(actionsOf().some((a) => a.action === 'setCustomType')).toBe(false);
    expect(actionsOf()).toContainEqual({ action: 'setCustomField', name: 'placedOnBehalfBy' });
  });
  it('the routes pass the value from the session only', () => {
    for (const file of [['app', 'api', 'checkout', 'session', 'route.ts'], ['app', 'api', 'dev', 'checkout', 'complete', 'route.ts']]) {
      const text = readFileSync(path.join(process.cwd(), ...file), 'utf8');
      expect(text, file.join('/')).toContain('placedOnBehalfBy: session.impersonatedBy');
    }
  });
});

describe('prepareCartForCheckout', () => {
  it('recalculates before the session', async () => {
    await prepareCartForCheckout(input, dev);
    expect(actionsOf()[0]).toEqual({ action: 'recalculate', updateProductData: true });
    expect(postActions.mock.calls[0].slice(0, 2)).toEqual(['mau-reseller-north', 'cart-1']);
  });
  it('writes fitVehicleLabel only with an active vehicle', async () => {
    await prepareCartForCheckout({ ...input, vehicleLabel: 'VW Golf 2016 2.0 TDI' }, dev);
    expect(written()).toMatchObject({ fitVehicleLabel: 'VW Golf 2016 2.0 TDI' });
    postActions.mockClear();
    await prepareCartForCheckout(input, dev);
    expect(written()).not.toHaveProperty('fitVehicleLabel');
  });
  it('isTest true outside production and absent in production', async () => {
    useCart(noCustom());
    await prepareCartForCheckout(input, dev);
    expect(actionsOf().find((a) => a.action === 'setCustomType')?.fields).toMatchObject({ isTest: true, salesChannel: 'web' });
    postActions.mockClear();
    await prepareCartForCheckout(input, prod);
    const fields = actionsOf().find((a) => a.action === 'setCustomType')?.fields;
    expect(fields).not.toHaveProperty('isTest');
    expect(fields).toMatchObject({ salesChannel: 'web' });
    expect(fields).toMatchObject({ salesChannel: 'web' });
  });
  it('leaves pickupBranchKey to the delivery preset of N', async () => {
    await prepareCartForCheckout(input, dev);
    expect(JSON.stringify(actionsOf())).not.toContain('pickupBranchKey');
  });
  it('updates existing custom fields one by one and skips unchanged ones', async () => {
    const withCustom = { ...ctCart(), custom: { type: { typeId: 'type', id: 't' }, fields: { isTest: true, salesChannel: 'web', fitVehicleLabel: 'old' } } };
    useCart(withCustom);
    await prepareCartForCheckout(input, dev);
    const names = actionsOf().filter((a) => a.action === 'setCustomField');
    expect(names).toEqual([{ action: 'setCustomField', name: 'fitVehicleLabel' }]);
  });
  it('prefills the email of a signed-in customer', async () => {
    await prepareCartForCheckout({ ...input, customerEmail: 'qa-1@example.com' }, dev);
    expect(actionsOf().find((a) => a.action === 'setCustomerEmail')).toEqual({ action: 'setCustomerEmail', email: 'qa-1@example.com' });
  });
  it('empty cart is refused', async () => {
    withCartRetry.mockImplementation(async (_s: string, _c: string, fn: (cart: unknown) => unknown) => fn({ ...ctCart(), lineItems: [] }));
    await expect(prepareCartForCheckout(input, dev)).rejects.toBeInstanceOf(EmptyCart);
    expect(postActions).not.toHaveBeenCalled();
  });
  it('an ordered cart is refused like an empty one', async () => {
    withCartRetry.mockImplementation(async (_s: string, _c: string, fn: (cart: unknown) => unknown) => fn({ ...ctCart(), cartState: 'Ordered' }));
    await expect(prepareCartForCheckout(input, dev)).rejects.toBeInstanceOf(EmptyCart);
  });
  it('capped line is refused with its id', async () => {
    getLineStock.mockResolvedValue(new Map([['BRK-1', { branchQty: 0, masterQty: 0 }], ['FLT-1', { branchQty: 1, masterQty: 0 }]]));
    const failure = await prepareCartForCheckout(input, dev).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(LinesUnavailable);
    expect((failure as LinesUnavailable).lineItemIds).toEqual(['li-1']);
    expect(postActions).not.toHaveBeenCalled();
  });
  it('recurring line refused when subscriptions are disabled', async () => {
    withCartRetry.mockImplementation(async (_s: string, _c: string, fn: (cart: unknown) => unknown) => fn(recurring()));
    await expect(prepareCartForCheckout(input, { production: false, subscriptionsEnabled: false })).rejects.toBeInstanceOf(SubscriptionsUnavailable);
  });
  it('recurring line allowed when enabled', async () => {
    withCartRetry.mockImplementation(async (_s: string, _c: string, fn: (cart: unknown) => unknown) => fn(recurring()));
    await expect(prepareCartForCheckout(input, dev)).resolves.toBeDefined();
  });
});

describe('no territory blocking (D7, owner answer Q-O03)', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));
  it('no territory or store countries check exists', () => {
    const root = path.resolve(import.meta.dirname, '..', '..');
    const files = [...walk(path.join(root, 'lib', 'checkout')), ...walk(path.join(root, 'components', 'checkout'))].filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/COUNTRY_NOT_SERVED|assertCartDeliverable|store\.countries|storeCountries/);
  });
});
