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

/**
 * A saved payment method as the buyer may see it: brand, last four digits, expiry and the default flag. The provider
 * token (the only card reference commercetools holds, `PaymentMethod.token.value`) is deliberately NOT part of this
 * type: no code outside the adapter can read it, render it or log it (payment-methods: "the only card reference the
 * storefront holds is the provider's token").
 */
export interface StoredMethodDescriptor {
  /** The commercetools PaymentMethod id (an identifier, not a secret). */
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface PaymentProvider {
  readonly kind: PaymentMode;
  /** A Checkout session for the cart (amount = the cart's total; the SDK reads it from the cart). */
  createSession(cart: PaymentCartRef): Promise<PaymentSessionInfo>;
  /** The state of the payment attached to the cart, read from the platform (never trusted from the browser). */
  getAuthorization(cartId: string): Promise<AuthorizationState>;
  /** Voids an authorization that must not be captured (stale amount, failed order). Idempotent. */
  release(paymentId: string): Promise<void>;
  /** The customer's saved methods (Checkout Stored Payment Methods, cards only), descriptors only. */
  listStoredMethods(customerId: string): Promise<StoredMethodDescriptor[]>;
  /**
   * Makes one saved method the default. `setDefault` is a per-method boolean (spec open question: it is not known
   * whether the platform clears the previous default), so the adapter clears every other default explicitly.
   * Throws `StoredMethodNotFoundError` for an id that is not the customer's.
   */
  setDefaultStoredMethod(customerId: string, methodId: string): Promise<void>;
  /**
   * Removes a saved method. No other method is promoted to default (the buyer chooses at the next checkout).
   * Throws `StoredMethodNotFoundError` for an id that is not the customer's.
   */
  removeStoredMethod(customerId: string, methodId: string): Promise<void>;
}

/** The id is not one of the customer's saved methods (unknown and somebody else's are the same). */
export class StoredMethodNotFoundError extends Error {
  constructor() {
    super('stored method not found');
    this.name = 'StoredMethodNotFoundError';
  }
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
