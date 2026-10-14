// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Bundles in the cart (workstream W-11). A bundle is ONE priced parent line (the bundle's own standalone price) plus one child line per
// component: quantity = bundle quantity times component quantity, `externalPrice` 0 (the price is the parent's), and the custom type `malva-line`
// field `parentLineItemId` pointing at the parent line. Children are locked: they follow the parent and are never changed or removed alone
// (the cart routes answer 422 `BUNDLE_CHILD_LOCKED`). The child price is set here on the server, never from a request body.
import 'server-only';
import type { Cart, CartUpdateAction, LineItem } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { childQuantity, type BundleComponent } from '@/lib/bundles/contents';
import { withCartRetry } from '@/lib/ct/cart-retry';
import { inStore } from '@/lib/ct/in-store';

export const LINE_TYPE_KEY = 'malva-line';
export const PARENT_FIELD = 'parentLineItemId';

/** The parent line id of a child line; `undefined` for any other line. */
export const parentOf = (line: LineItem): string | undefined => {
  const value = line.custom?.fields?.[PARENT_FIELD];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};
export const isBundleChild = (line: LineItem): boolean => parentOf(line) !== undefined;
export const childrenOf = (cart: Cart, parentLineId: string): LineItem[] => (cart.lineItems ?? []).filter((l) => parentOf(l) === parentLineId);

/**
 * The actions that make the children of `parentLineId` match `components` for `bundleQty` bundles: add the missing ones (external price 0,
 * `malva-line` with the parent id), change the quantity of the ones that exist, remove the ones whose component left the bundle.
 */
export function planBundleChildren(cart: Cart, parentLineId: string, bundleQty: number, components: readonly BundleComponent[]): CartUpdateAction[] {
  const existing = childrenOf(cart, parentLineId);
  const currencyCode = cart.totalPrice.currencyCode;
  const actions: CartUpdateAction[] = [];
  for (const component of components) {
    const quantity = childQuantity(bundleQty, component.qty);
    const child = existing.find((l) => l.variant.sku === component.sku);
    if (!child) {
      actions.push({
        action: 'addLineItem',
        sku: component.sku,
        quantity,
        externalPrice: { currencyCode, centAmount: 0 },
        custom: { type: { typeId: 'type', key: LINE_TYPE_KEY }, fields: { [PARENT_FIELD]: parentLineId } },
      });
    } else if (child.quantity !== quantity) {
      actions.push({ action: 'changeLineItemQuantity', lineItemId: child.id, quantity });
    }
  }
  for (const child of existing) {
    if (!components.some((c) => c.sku === child.variant.sku)) actions.push({ action: 'removeLineItem', lineItemId: child.id });
  }
  return actions;
}

export interface AddBundleOptions {
  components: readonly BundleComponent[];
  /** The `addLineItem` of the parent line (sku, quantity, price channel, vehicle fields). */
  parentAction: CartUpdateAction;
  /** Sends actions on the cart's version and answers the new cart (the caller owns the retry on a version conflict). */
  post: (cart: Cart, actions: CartUpdateAction[]) => Promise<Cart>;
}

/**
 * Adds `qty` bundles: first the parent line, then (its line id is only known now) all child lines in one update. A bundle that is already in
 * the cart keeps its single parent line (commercetools merges the quantity) and its children follow the new quantity. If the children cannot
 * be written a parent line created by this call is removed again, so a parent never stays without its children.
 */
export async function addBundle(cart: Cart, bundleSku: string, qty: number, options: AddBundleOptions): Promise<Cart> {
  const existedBefore = (cart.lineItems ?? []).some((l) => l.variant.sku === bundleSku && !isBundleChild(l));
  if (!Number.isInteger(qty) || qty < 1) throw new ApiError(400, 'Quantity must be at least 1'); // `parentAction` carries it; the children follow the parent line's total
  const withParent = await options.post(cart, [options.parentAction]);
  const parent = (withParent.lineItems ?? []).find((l) => l.variant.sku === bundleSku && !isBundleChild(l));
  if (!parent) throw new Error('The bundle line was not added');
  const plan = planBundleChildren(withParent, parent.id, parent.quantity, options.components);
  if (plan.length === 0) return withParent;
  try {
    return await options.post(withParent, plan);
  } catch (error) {
    if (!existedBefore) await options.post(withParent, [{ action: 'removeLineItem', lineItemId: parent.id }]).catch(() => undefined);
    throw error;
  }
}

async function send(storeKey: string, cartId: string, build: (cart: Cart) => CartUpdateAction[]): Promise<Cart> {
  return withCartRetry(storeKey, cartId, async (current) => {
    const { body } = await inStore(storeKey).carts().withId({ ID: cartId }).post({ body: { version: current.version, actions: build(current) } }).execute();
    return body;
  });
}

/** The parent line and its children, or a 404 for any other line (a child, a plain part, an unknown id). */
function parentAndChildren(cart: Cart, parentLineId: string): { parent: LineItem; children: LineItem[] } {
  const parent = (cart.lineItems ?? []).find((l) => l.id === parentLineId && !isBundleChild(l));
  const children = parent ? childrenOf(cart, parent.id) : [];
  if (!parent || children.length === 0) throw new ApiError(404, 'Not found');
  return { parent, children };
}

/** One update: the parent at `quantity` and every child at `quantity` times its per-bundle quantity (the ratio of the lines as they are). */
export async function setBundleQuantity(storeKey: string, cartId: string, parentLineId: string, quantity: number): Promise<Cart> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new ApiError(400, 'Quantity must be at least 1');
  return send(storeKey, cartId, (cart) => {
    const { parent, children } = parentAndChildren(cart, parentLineId);
    return [
      { action: 'changeLineItemQuantity', lineItemId: parent.id, quantity },
      ...children.map((child): CartUpdateAction => ({ action: 'changeLineItemQuantity', lineItemId: child.id, quantity: childQuantity(quantity, Math.max(1, Math.round(child.quantity / parent.quantity))) })),
    ];
  });
}

/** One update: the children and the parent line go together. */
export async function removeBundle(storeKey: string, cartId: string, parentLineId: string): Promise<Cart> {
  return send(storeKey, cartId, (cart) => {
    const { parent, children } = parentAndChildren(cart, parentLineId);
    return [...children, parent].map((l): CartUpdateAction => ({ action: 'removeLineItem', lineItemId: l.id }));
  });
}
