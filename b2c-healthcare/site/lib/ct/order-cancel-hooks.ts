import 'server-only';
import { restoreAllowance as restoreAllowanceDraw, type RestoreAllowanceResult } from '@/lib/ct/allowance';

/**
 * Hooks that cancelling an order calls for what the order used up besides the prescription refill (which N's
 * `restoreAuthorization` gives back). Both are idempotent (a retried cancel calls them again) and do nothing for an
 * order that never used either.
 */

/**
 * Gives back what the order drew from the member's allowance. Returns the outcome (`restored`,
 * `unrecoverable` when the cycle it came from has closed, `already`, `none`).
 */
export async function restoreAllowance(orderId: string): Promise<RestoreAllowanceResult> {
  return restoreAllowanceDraw(orderId);
}

/**
 * Restricted-instrument amounts need no balance to give back: the instrument is a Payment on the order, and the
 * refund marker the cancel writes per Payment (card for the card share, instrument for the instrument share) is
 * the routing. This hook only keeps the order's record explicit: it is where a real instrument would be credited.
 */
export async function restoreRestricted(_orderId: string): Promise<void> {
  // The routing by recorded split is done per Payment in `lib/ct/order-cancel.ts` (see tender.ts `refundRouting`).
}
