import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { getCheckoutState } from '@/lib/ct/checkout';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout -> 200 CheckoutState (workstream K). The cart is read only from the session's `cartId`; nothing in the
 * request names a cart. The state carries every line with its group key, the pickup store, the delivery note, the codes read
 * back from the cart, the summary (the engine's totals) and the issues. Errors: 404 cart_not_found, 409 cart_empty.
 */
export const GET = handle('/api/checkout', async () => {
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const { state, session: next } = await getCheckoutState(session, market);
  if (!state) return domainError('cart_not_found', 404);
  if (state.cart.lines.length === 0) return domainError('cart_empty', 409);
  const res = NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  return session.cartId === next.cartId ? res : setSessionCookie(res, await createSessionToken(next));
});
