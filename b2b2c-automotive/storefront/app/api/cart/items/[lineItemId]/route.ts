// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `PATCH /api/cart/items/{lineItemId}` { quantity (1 to 99) } and `DELETE`: both answer `{ cart }`.
// A bundle's component lines are locked (422 `BUNDLE_CHILD_LOCKED`); the bundle's own line changes or goes with all its components (W-11).
// The app caps the quantity by stock (the cart runs `TrackOnly`, D13): branch stock plus warehouse stock. A request above that is
// lowered to what is available and answered with `notice: 'capped'`; with nothing available the line stays as it is and the notice
// is `out-of-stock`.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { cartJson, cartRouteContext, withSessionCart } from '@/lib/cart-route';
import { bundleUnits } from '@/lib/bundles/contents';
import { getCart, removeLine, setLineQuantity } from '@/lib/ct/cart';
import { childrenOf, isBundleChild, removeBundle, setBundleQuantity } from '@/lib/ct/cart-bundles';
import { buildCartView, scopeOf } from '@/lib/ct/cart-view';
import { getLineStock } from '@/lib/ct/inventory';
import { splitStock } from '@/lib/store/stock';

// Strict: a body never carries a price, a custom field or anything but the quantity (W-11).
const body = z.object({ quantity: z.number().int().min(1).max(99) }).strict();
const LINE_ID = /^[A-Za-z0-9_-]{1,64}$/;
type Params = { params: Promise<{ lineItemId: string }> };

async function lineIdOf({ params }: Params): Promise<string> {
  const { lineItemId } = await params;
  if (!LINE_ID.test(lineItemId)) throw new ApiError(404, 'Not found');
  return lineItemId;
}

export const PATCH = handle(async (request: Request, route: Params) => {
  const lineItemId = await lineIdOf(route);
  const { quantity } = await parseJson(request, body);
  const context = await cartRouteContext();
  return withSessionCart(context, async (cartId) => {
    const current = await getCart(context.session.storeKey, cartId);
    const line = current?.lineItems.find((l) => l.id === lineItemId);
    if (!current || !line) throw new ApiError(404, 'Not found');
    // A bundle's component lines follow their parent and are never changed alone (W-11).
    if (isBundleChild(line)) throw new ApiError(422, 'BUNDLE_CHILD_LOCKED');

    const { scope } = await scopeOf(context.view);
    const children = childrenOf(current, line.id);
    if (children.length > 0) {
      // A bundle line: the parent and its components change together; the most bundles are what the scarcest component allows.
      const components = children.map((child) => ({ sku: child.variant.sku ?? '', qty: Math.max(1, Math.round(child.quantity / line.quantity)) }));
      const stock = await getLineStock(components.map((c) => c.sku), scope.branchChannelId);
      const units = bundleUnits(components, Object.fromEntries(components.map((c) => [c.sku, (stock.get(c.sku)?.branchQty ?? 0) + (stock.get(c.sku)?.masterQty ?? 0)])));
      if (units < 1) return cartJson({ cart: await buildCartView(current, context.view), notice: 'out-of-stock' });
      const target = Math.min(quantity, units);
      const updated = target === line.quantity ? current : await setBundleQuantity(context.session.storeKey, cartId, lineItemId, target);
      return cartJson({ cart: await buildCartView(updated, context.view), ...(target < quantity ? { notice: 'capped' as const } : {}) });
    }
    const stock = await getLineStock([line.variant.sku ?? ''], scope.branchChannelId);
    const split = splitStock(quantity, stock.get(line.variant.sku ?? '') ?? { branchQty: 0, masterQty: 0 });
    const available = split.fromStore + split.shipsLater;
    if (available < 1) return cartJson({ cart: await buildCartView(current, context.view), notice: 'out-of-stock' });

    const target = Math.min(quantity, available);
    const updated = target === line.quantity ? current : await setLineQuantity(context.session.storeKey, cartId, lineItemId, target);
    return cartJson({ cart: await buildCartView(updated, context.view), ...(target < quantity ? { notice: 'capped' as const } : {}) });
  });
});

export const DELETE = handle(async (_request: Request, route: Params) => {
  const lineItemId = await lineIdOf(route);
  const context = await cartRouteContext();
  return withSessionCart(context, async (cartId) => {
    const current = await getCart(context.session.storeKey, cartId);
    const line = current?.lineItems.find((l) => l.id === lineItemId);
    if (current && line && isBundleChild(line)) throw new ApiError(422, 'BUNDLE_CHILD_LOCKED');
    const isBundle = current && line ? childrenOf(current, line.id).length > 0 : false;
    const updated = isBundle ? await removeBundle(context.session.storeKey, cartId, lineItemId) : await removeLine(context.session.storeKey, cartId, lineItemId);
    return cartJson({ cart: await buildCartView(updated, context.view) });
  });
});
