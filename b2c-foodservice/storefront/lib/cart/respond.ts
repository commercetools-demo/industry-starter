import 'server-only';
import { NextResponse } from 'next/server';
import { domainError } from '@/lib/api-domain';
import { CodeRejected, LineRejected, currentCartView } from '@/lib/ct/cart';
import { createSessionToken, getMarket, setSessionCookie, type Session } from '@/lib/session';
import type { Cart } from '@/lib/types';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** `{ cart }`, never cached. The session cookie is written only when the cart id changed (rebuild, stale clear). */
export async function cartResponse(cart: Cart | null, before: Session, after: Session = before): Promise<Response> {
  const res = NextResponse.json({ cart }, { headers: NO_STORE });
  if (before.cartId === after.cartId) return res;
  return setSessionCookie(res, await createSessionToken(after));
}

/**
 * Cart refusals as domain responses in the shared envelope. A refused discount code answers
 * `422 code_not_applied { details: { reason, cart } }` with the cart exactly as the engine has it, so the client replaces its
 * copy and no stale total survives. Returns null for anything else (the caller rethrows).
 */
export async function rejectionResponse(e: unknown, session: Session): Promise<Response | null> {
  if (e instanceof LineRejected) return domainError(e.code, e.status, e.extra);
  if (e instanceof CodeRejected) {
    const cart = await currentCartView(session, await getMarket());
    return domainError('code_not_applied', 422, { details: { reason: e.reason, cart } });
  }
  return null;
}

/** A line id is a commercetools id (a UUID): anything else is refused before a call is made. */
export const LINE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
/** A seeded store key. */
export const STORE_KEY_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
