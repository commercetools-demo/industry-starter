import type { PaymentMode, PaymentSessionInfo } from '@/lib/types';

/**
 * Seam between checkout and the payment service (D-026: commercetools Checkout in payment-only mode with a Stripe
 * connector). The storefront never sees card data: the browser SDK talks to Checkout directly; the server only
 * creates the session, reads whether the cart's Payment is authorized, and releases an authorization.
 *
 * Two implementations: `checkout-provider.ts` (the real Checkout adapter) and `fake-provider.ts` (dev/test only,
 * `MALVA_FIXTURES=1`, never in production). Everything else depends on this interface.
 */

export interface PaymentCartRef {
  id: string;
  total: { centAmount: number; currencyCode: string };
}

export type AuthorizationState =
  | { status: 'none' }
  | { status: 'declined'; paymentId: string }
  | { status: 'authorized'; paymentId: string; centAmount: number; currencyCode: string };

export interface PaymentProvider {
  readonly kind: PaymentMode;
  /** A Checkout session for the cart (amount = the cart's total; the SDK reads it from the cart). */
  createSession(cart: PaymentCartRef): Promise<PaymentSessionInfo>;
  /** The state of the payment attached to the cart, read from the platform (never trusted from the browser). */
  getAuthorization(cartId: string): Promise<AuthorizationState>;
  /** Voids an authorization that must not be captured (stale amount, failed order). Idempotent. */
  release(paymentId: string): Promise<void>;
}

/** The payment service is not configured (OA-04) or unreachable. The message is safe to show. */
export class PaymentUnavailableError extends Error {
  constructor(message = 'Payment is not available right now.') {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}

/** Which path the page uses, without loading a provider: the fake only exists under the development switch. */
export function paymentModeNow(env: Record<string, string | undefined> = process.env): PaymentMode {
  return env.MALVA_FIXTURES === '1' && env.NODE_ENV !== 'production' ? 'demo' : 'psp';
}
