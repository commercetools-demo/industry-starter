// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `PATCH /api/cart/items/{lineItemId}` { quantity (1 to 99) } and `DELETE`: both answer `{ cart }`.
// The app caps the quantity by stock (the cart runs `TrackOnly`, D13): branch stock plus warehouse stock. A request above that is
// lowered to what is available and answered with `notice: 'capped'`; with nothing available the line stays as it is and the notice
// is `out-of-stock`.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { cartJson, cartRouteContext, withSessionCart } from '@/lib/cart-route';
import { getCart, removeLine, setLineQuantity } from '@/lib/ct/cart';
import { buildCartView, scopeOf } from '@/lib/ct/cart-view';
import { getLineStock } from '@/lib/ct/inventory';
import { splitStock } from '@/lib/store/stock';

const body = z.object({ quantity: z.number().int().min(1).max(99) });
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

    const { scope } = await scopeOf(context.view);
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
    const updated = await removeLine(context.session.storeKey, cartId, lineItemId);
    return cartJson({ cart: await buildCartView(updated, context.view) });
  });
});
