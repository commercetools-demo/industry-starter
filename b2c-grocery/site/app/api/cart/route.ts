import { NextResponse } from 'next/server';
import { cartFailure, cartJson, clearedCartJson } from '@/lib/cart-api';
import { getCart } from '@/lib/ct/cart';
import { getMarket, getSession } from '@/lib/session';

/** The session cart (anonymous visitors included). No cart id or a non-Active cart: `{ cart: null }`. */
export async function GET() {
  const session = await getSession();
  if (!session.cartId) return NextResponse.json({ cart: null });
  try {
    const cart = await getCart(session.cartId);
    if (!cart) return await clearedCartJson();
    return await cartJson(cart, await getMarket());
  } catch (e) {
    return cartFailure(e);
  }
}
