import { cartFailure, cartJson, clearedCartJson, jsonError, readJson } from '@/lib/cart-api';
import { getCart, setLineItemSubstitution, withCartRetry } from '@/lib/ct/cart';
import { getMarket, getSession } from '@/lib/session';
import type { SubstitutionPreference } from '@/lib/types';

type Context = { params: Promise<{ lineId: string }> };

const isPreference = (v: unknown): v is SubstitutionPreference => v === 'allow-similar' || v === 'none';

/** Sets the line's substitution preference (`allow-similar` | `none`). Invalid value: 400 `INVALID_PREFERENCE`. Answers with the cart. */
export async function PATCH(request: Request, { params }: Context) {
  const { lineId } = await params;
  const { preference } = await readJson(request);
  if (!isPreference(preference)) return jsonError('INVALID_PREFERENCE', 400);

  try {
    const session = await getSession();
    if (!session.cartId) return jsonError('CART_NOT_FOUND', 404);
    const cart = await getCart(session.cartId);
    if (!cart) return await clearedCartJson();
    if (!cart.lineItems.some((l) => l.id === lineId)) return jsonError('LINE_NOT_FOUND', 404);

    const updated = await withCartRetry(cart.id, (c) => setLineItemSubstitution(c, lineId, preference));
    return await cartJson(updated, await getMarket());
  } catch (e) {
    return cartFailure(e);
  }
}
