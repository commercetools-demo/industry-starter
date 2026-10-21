import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { getCartForSession } from '@/lib/ct/cart';
import { createSessionToken, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cart -> 200 { cart: CartSummary | null }. CartSummary is `{ id, version, count, lines: [{ id, sku, quantity }] }`
 * (workstream I keeps these fields when it returns the full cart). A missing, deleted or no longer Active cart gives
 * `cart: null` and its id is removed from the session. Never cached.
 */
export const GET = handle('/api/cart', async () => {
  const session = await getSession();
  const headers = { 'Cache-Control': 'no-store' };
  const cart = await getCartForSession(session);
  if (cart || !session.cartId) return NextResponse.json({ cart }, { headers });
  const next = { ...session };
  delete next.cartId;
  return setSessionCookie(NextResponse.json({ cart: null }, { headers }), await createSessionToken(next));
});
