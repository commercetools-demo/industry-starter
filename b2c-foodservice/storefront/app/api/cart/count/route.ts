import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { getCartUnitCount } from '@/lib/ct/cart';
import { createSessionToken, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cart/count -> 200 { count } where count is the number of units (3 units on 2 lines is 3).
 * 0 without a cart. A cart that is no longer Active is forgotten: its id is removed from the session.
 * Never cached. Workstream I may replace the hook source with `useCart()` but keeps this route.
 */
export const GET = handle('/api/cart/count', async () => {
  const session = await getSession();
  const headers = { 'Cache-Control': 'no-store' };
  if (!session.cartId) return NextResponse.json({ count: 0 }, { headers });
  const count = await getCartUnitCount(session.cartId);
  if (count !== null) return NextResponse.json({ count }, { headers });
  const next = { ...session };
  delete next.cartId;
  return setSessionCookie(NextResponse.json({ count: 0 }, { headers }), await createSessionToken(next));
});
