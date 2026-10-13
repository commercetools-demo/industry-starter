// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import type { Cart, CartUpdateAction, LineItem } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cartGet = vi.hoisted(() => vi.fn());
const cartPost = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: {
    inStoreKeyWithStoreKeyValue: () => ({
      carts: () => ({ withId: () => ({ get: () => ({ execute: cartGet }), post: (a: unknown) => ({ execute: () => cartPost(a) }) }) }),
    }),
  },
  projectKey: 'p',
}));

import { addBundle, childrenOf, isBundleChild, parentOf, planBundleChildren, removeBundle, setBundleQuantity } from './cart-bundles';

const COMPONENTS = [
  { sku: 'SK-1', qty: 2 },
  { sku: 'SK-2', qty: 1 },
];
const line = (id: string, sku: string, quantity: number, parent?: string): LineItem =>
  ({ id, quantity, variant: { sku }, ...(parent ? { custom: { type: { typeId: 'type', id: 't' }, fields: { parentLineItemId: parent } } } : {}) }) as unknown as LineItem;
const cart = (lines: LineItem[], version = 1): Cart => ({ id: 'cart-1', version, cartState: 'Active', totalPrice: { currencyCode: 'EUR' }, lineItems: lines }) as unknown as Cart;
const childAdd = (sku: string, quantity: number, parent: string) => ({
  action: 'addLineItem',
  sku,
  quantity,
  externalPrice: { currencyCode: 'EUR', centAmount: 0 },
  custom: { type: { typeId: 'type', key: 'malva-line' }, fields: { parentLineItemId: parent } },
});

beforeEach(() => {
  cartGet.mockReset();
  cartPost.mockReset();
});

describe('bundle lines', () => {
  it('a child is a line with a parentLineItemId; children are found by parent', () => {
    const c = cart([line('p', 'BND-1', 1), line('c1', 'SK-1', 2, 'p'), line('c2', 'SK-2', 1, 'p'), line('x', 'SK-1', 1)]);
    expect(isBundleChild(c.lineItems[1])).toBe(true);
    expect(isBundleChild(c.lineItems[0])).toBe(false);
    expect(parentOf(c.lineItems[2])).toBe('p');
    expect(childrenOf(c, 'p').map((l) => l.id)).toEqual(['c1', 'c2']);
  });
});

describe('planBundleChildren: parent line first, then the children (W-11)', () => {
  it('adds one child per component: quantity bundle times component, external price 0, parent id in malva-line', () => {
    const plan = planBundleChildren(cart([line('p', 'BND-1', 3)]), 'p', 3, COMPONENTS);
    expect(plan).toEqual([childAdd('SK-1', 6, 'p'), childAdd('SK-2', 3, 'p')]);
  });
  it('children that exist follow the parent quantity and are not added twice', () => {
    const c = cart([line('p', 'BND-1', 3), line('c1', 'SK-1', 2, 'p'), line('c2', 'SK-2', 3, 'p')]);
    expect(planBundleChildren(c, 'p', 3, COMPONENTS)).toEqual([{ action: 'changeLineItemQuantity', lineItemId: 'c1', quantity: 6 }]);
  });
  it('children of another bundle line are not touched', () => {
    const c = cart([line('p', 'BND-1', 1), line('q', 'BND-2', 1), line('c9', 'SK-1', 2, 'q')]);
    expect(planBundleChildren(c, 'p', 1, COMPONENTS)).toEqual([childAdd('SK-1', 2, 'p'), childAdd('SK-2', 1, 'p')]);
  });
  it('a child whose component left the bundle is removed', () => {
    const c = cart([line('p', 'BND-1', 1), line('c1', 'SK-1', 2, 'p'), line('c7', 'SK-7', 1, 'p')]);
    expect(planBundleChildren(c, 'p', 1, [{ sku: 'SK-1', qty: 2 }])).toEqual([{ action: 'removeLineItem', lineItemId: 'c7' }]);
  });
});

describe('addBundle', () => {
  const parentAction = { action: 'addLineItem', sku: 'BND-1', quantity: 2, distributionChannel: { typeId: 'channel', id: 'ch-r' } } as CartUpdateAction;

  it('adds the parent, reads its line id, then adds the children in one update', async () => {
    const sent: CartUpdateAction[][] = [];
    const post = vi.fn(async (current: Cart, actions: CartUpdateAction[]) => {
      sent.push(actions);
      return sent.length === 1 ? cart([line('parent-9', 'BND-1', 2)], current.version + 1) : cart([line('parent-9', 'BND-1', 2), line('k1', 'SK-1', 4, 'parent-9'), line('k2', 'SK-2', 2, 'parent-9')], current.version + 1);
    });
    const out = await addBundle(cart([]), 'BND-1', 2, { components: COMPONENTS, parentAction, post });
    expect(sent[0]).toEqual([parentAction]);
    expect(sent[1]).toEqual([childAdd('SK-1', 4, 'parent-9'), childAdd('SK-2', 2, 'parent-9')]);
    expect(sent).toHaveLength(2);
    expect(out.lineItems).toHaveLength(3);
  });
  it('a bundle that is already in the cart keeps one parent line and the children follow its new quantity', async () => {
    const existing = cart([line('p', 'BND-1', 1), line('c1', 'SK-1', 2, 'p'), line('c2', 'SK-2', 1, 'p')]);
    const post = vi.fn(async (_c: Cart, actions: CartUpdateAction[]) => (actions[0].action === 'addLineItem' ? cart([line('p', 'BND-1', 3), line('c1', 'SK-1', 2, 'p'), line('c2', 'SK-2', 1, 'p')]) : existing));
    await addBundle(existing, 'BND-1', 2, { components: COMPONENTS, parentAction, post });
    expect(post.mock.calls[1][1]).toEqual([
      { action: 'changeLineItemQuantity', lineItemId: 'c1', quantity: 6 },
      { action: 'changeLineItemQuantity', lineItemId: 'c2', quantity: 3 },
    ]);
  });
  it('when the children cannot be added a new parent line is taken out again, never left without its children', async () => {
    const post = vi.fn(async (_c: Cart, actions: CartUpdateAction[]) => {
      if (post.mock.calls.length === 1) return cart([line('parent-9', 'BND-1', 2)]);
      if (actions[0].action === 'removeLineItem') return cart([]);
      throw new Error('boom');
    });
    await expect(addBundle(cart([]), 'BND-1', 2, { components: COMPONENTS, parentAction, post })).rejects.toThrow('boom');
    expect(post.mock.calls[2][1]).toEqual([{ action: 'removeLineItem', lineItemId: 'parent-9' }]);
  });
});

describe('setBundleQuantity and removeBundle act on parent and children together', () => {
  const full = () => cart([line('p', 'BND-1', 2), line('c1', 'SK-1', 4, 'p'), line('c2', 'SK-2', 2, 'p'), line('other', 'SK-5', 1)], 7);
  beforeEach(() => {
    cartGet.mockResolvedValue({ body: full() });
    cartPost.mockResolvedValue({ body: full() });
  });

  it('quantity: one update, the children keep their per bundle quantity', async () => {
    await setBundleQuantity('mau-reseller-north', 'cart-1', 'p', 5);
    expect(cartPost).toHaveBeenCalledTimes(1);
    expect(cartPost.mock.calls[0][0].body.version).toBe(7);
    expect(cartPost.mock.calls[0][0].body.actions).toEqual([
      { action: 'changeLineItemQuantity', lineItemId: 'p', quantity: 5 },
      { action: 'changeLineItemQuantity', lineItemId: 'c1', quantity: 10 },
      { action: 'changeLineItemQuantity', lineItemId: 'c2', quantity: 5 },
    ]);
  });
  it('remove: one update that removes the children and the parent, nothing else', async () => {
    await removeBundle('mau-reseller-north', 'cart-1', 'p');
    expect(cartPost).toHaveBeenCalledTimes(1);
    expect(cartPost.mock.calls[0][0].body.actions).toEqual([
      { action: 'removeLineItem', lineItemId: 'c1' },
      { action: 'removeLineItem', lineItemId: 'c2' },
      { action: 'removeLineItem', lineItemId: 'p' },
    ]);
  });
  it('a line that is not a bundle parent is a plain 404 for both', async () => {
    await expect(setBundleQuantity('mau-reseller-north', 'cart-1', 'other', 2)).rejects.toMatchObject({ status: 404 });
    await expect(removeBundle('mau-reseller-north', 'cart-1', 'nope')).rejects.toMatchObject({ status: 404 });
    expect(cartPost).not.toHaveBeenCalled();
  });
});
