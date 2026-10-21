import type { Cart } from '@/lib/types';

export type CheckoutBlocker =
  | { code: 'sign_in_required' }
  | { code: 'checkout_blocked'; reason: string };

/** True when the bag holds a subscribe line and nobody is signed in. Pure. */
export function subscribeNeedsAccount(cart: Pick<Cart, 'lines'>, session: { customerId?: string }): boolean {
  return !session.customerId && cart.lines.some((l) => l.fulfilment === 'subscribe' || Boolean(l.recurrence));
}

/**
 * What stops a bag from reaching payment, beyond the cart blockers the cart view already carries. K left it empty; workstream N
 * appended its rule (a bag with a subscribe line needs a signed-in customer) without touching K's flow.
 * K's session handler answers the first blocker as `401 sign_in_required` or `409 checkout_blocked`.
 */
export const EXTRA_BLOCKERS: Array<(cart: Cart, session: { customerId?: string }) => CheckoutBlocker | null> = [
  // Workstream N (Q-N-4): a subscription is managed in the account, so a guest cannot pay for one.
  (cart, session) => (subscribeNeedsAccount(cart, session) ? { code: 'sign_in_required' } : null),
];

export function checkoutBlockers(cart: Cart, session: { customerId?: string }): CheckoutBlocker[] {
  const out: CheckoutBlocker[] = [];
  for (const rule of EXTRA_BLOCKERS) {
    const blocker = rule(cart, session);
    if (blocker) out.push(blocker);
  }
  for (const reason of cart.blockers) out.push({ code: 'checkout_blocked', reason });
  return out;
}
