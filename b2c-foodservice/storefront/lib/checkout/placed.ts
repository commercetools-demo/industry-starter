import 'server-only';
import type { NextResponse } from 'next/server';
import { GUEST_EMAIL_COOKIE } from '@/lib/auth/guest-email';
import { baseOrderNumber, orderNumberForCart } from '@/lib/checkout/order-number';
import { clearPayParts, type PayPart } from '@/lib/checkout/pay-cookie';
import { removePaidLines } from '@/lib/ct/checkout';
import { createSessionToken, setSessionCookie, type Session } from '@/lib/session';
import type { OrderView } from '@/lib/types';

export interface Placement {
  /** The session to persist: `cartId` removed once the last payment is placed. */
  session: Session;
  /** Another payment is due (complete-per-group): its part index. null when the purchase is complete. */
  next: number | null;
  /** The pay-cart cookie can go. */
  clearParts: boolean;
  /** The order email for the guest cookie (guest orders only). */
  guestEmail: string | null;
  /** The order belongs to this session's bag; false means nothing was changed. */
  matched: boolean;
}

const SUFFIXES = 'ABCDEFGH';

/** Index of a payment part from its order number suffix (`-A` is 0); no suffix is 0. */
export function partOf(orderNumber: string): number {
  const m = /-([A-H])$/.exec(orderNumber);
  return m ? SUFFIXES.indexOf(m[1] as string) : 0;
}

/**
 * What a placed order does to the shopper's session (workstream K 3.7 "Placement"). Only an order of THIS bag changes anything:
 * its number must be the bag's number (or one of its part numbers), so an order id taken from a query string can never empty
 * somebody's cart. A part removes its lines from the bag (the bag then holds what still needs payment); the last one also
 * removes `cartId` from the session.
 */
export async function afterPlacement(session: Session, parts: readonly PayPart[], order: OrderView): Promise<Placement> {
  const unchanged: Placement = { session, next: null, clearParts: false, guestEmail: null, matched: false };
  if (!session.cartId || baseOrderNumber(order.orderNumber) !== orderNumberForCart(session.cartId)) return unchanged;
  const index = partOf(order.orderNumber);
  const guestEmail = !session.customerId && order.customerId === null && order.email ? order.email : null;
  // Every paid part leaves the old bag, the last one too: the bag stays an Active cart in the project, and one that still held
  // paid lines would come back at the next sign-in (found by Q, J2).
  const paid = parts[index];
  if (paid) {
    try {
      await removePaidLines(session, paid.id);
    } catch {
      console.warn(JSON.stringify({ event: 'remove_paid_lines_failed', orderId: order.id }));
    }
  }
  if (parts.length > 0 && index < parts.length - 1) {
    return { session, next: index + 1, clearParts: false, guestEmail, matched: true };
  }
  const next = { ...session };
  delete next.cartId;
  return { session: next, next: null, clearParts: true, guestEmail, matched: true };
}

/** Writes a completed purchase into the response: the session without its bag, no pay cookie, and the guest email cookie (1 hour, HTTP-only, never in a URL). */
export async function applyPlacement<T extends NextResponse>(res: T, p: Placement): Promise<T> {
  if (!p.matched || p.next !== null) return res;
  if (p.clearParts) clearPayParts(res);
  if (p.guestEmail) res.cookies.set(GUEST_EMAIL_COOKIE, p.guestEmail, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600, secure: process.env.NODE_ENV === 'production' });
  setSessionCookie(res, await createSessionToken(p.session));
  return res;
}
