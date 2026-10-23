import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { paymentsOf, readPayParts } from '@/lib/checkout/pay-cookie';
import { getCheckoutState } from '@/lib/ct/checkout';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout -> 200 CheckoutState (workstream K). The cart is read only from the session's `cartId`; nothing in the
 * request names a cart. The state carries every line with its group key, the pickup store, the delivery note, the codes read
 * back from the cart, the summary (the engine's totals) and the issues. `?resume=1` adds `payments` from the pay cookie. Errors: 404 cart_not_found, 409 cart_empty.
 */
export const GET = handle('/api/checkout', async (req) => {
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const { state, session: next } = await getCheckoutState(session, market);
  if (!state) return domainError('cart_not_found', 404);
  if (state.cart.lines.length === 0) return domainError('cart_empty', 409);
  // `?resume=1` (after a redirect payment of one part) brings back the payments still to make; a normal read never does.
  const parts = new URL(req.url).searchParams.get('resume') === '1' ? await readPayParts() : [];
  const res = NextResponse.json(parts.length ? { ...state, payments: paymentsOf(parts) } : state, { headers: { 'Cache-Control': 'no-store' } });
  return session.cartId === next.cartId ? res : setSessionCookie(res, await createSessionToken(next));
});
