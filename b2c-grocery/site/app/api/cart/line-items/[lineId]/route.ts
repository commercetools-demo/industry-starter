import { cartFailure, cartJson, clearedCartJson, isValidQuantity, jsonError, readJson } from '@/lib/cart-api';
import { getAvailableQuantity } from '@/lib/ct/availability';
import { changeLineItemQuantity, getCart, removeLineItem, withCartRetry } from '@/lib/ct/cart';
import { getMarket, getSession } from '@/lib/session';

type Context = { params: Promise<{ lineId: string }> };

/** Change a line's quantity (minimum 1; use DELETE to remove). Same availability rule as adding. */
export async function PATCH(request: Request, { params }: Context) {
  const { lineId } = await params;
  const { quantity } = await readJson(request);
  if (!isValidQuantity(quantity)) return jsonError('INVALID_QUANTITY', 400);

  try {
    const session = await getSession();
    if (!session.cartId) return jsonError('CART_NOT_FOUND', 404);
    const cart = await getCart(session.cartId);
    if (!cart) return await clearedCartJson();
    const line = cart.lineItems.find((l) => l.id === lineId);
    if (!line) return jsonError('LINE_NOT_FOUND', 404);

    const available = await getAvailableQuantity(line.variant.sku ?? '');
    if (quantity > available) return jsonError('INSUFFICIENT_STOCK', 409, { available });

    const updated = await withCartRetry(cart.id, (c) => changeLineItemQuantity(c.id, c.version, lineId, quantity));
    return await cartJson(updated, await getMarket());
  } catch (e) {
    return cartFailure(e);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const { lineId } = await params;
  try {
    const session = await getSession();
    if (!session.cartId) return jsonError('CART_NOT_FOUND', 404);
    const cart = await getCart(session.cartId);
    if (!cart) return await clearedCartJson();
    if (!cart.lineItems.some((l) => l.id === lineId)) return jsonError('LINE_NOT_FOUND', 404);

    const updated = await withCartRetry(cart.id, (c) => removeLineItem(c.id, c.version, lineId));
    return await cartJson(updated, await getMarket());
  } catch (e) {
    return cartFailure(e);
  }
}
