import 'server-only';

/**
 * Hooks that cancelling an order calls for what the order used up besides the prescription refill (which N's
 * `restoreAuthorization` gives back). Both are NO-OPS today: workstream U (allowance and restricted funds) fills
 * them in. They must be idempotent (a retried cancel calls them again) and must not throw for an order that never
 * used either.
 */

/** Gives back what the order took from the member's allowance (U). */
export async function restoreAllowance(_orderId: string): Promise<void> {
  // U
}

/** Gives back restricted-fund amounts the order used (U). */
export async function restoreRestricted(_orderId: string): Promise<void> {
  // U
}
