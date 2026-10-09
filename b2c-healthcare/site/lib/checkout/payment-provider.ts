import type { PaymentMode, PaymentSessionInfo } from '@/lib/types';

/**
 * Seam between the storefront and the payment service (the FULL commercetools Checkout, connected to the
 * Stripe connector). Checkout creates the order and owns the payment lifecycle (authorize, capture, cancel, refund,
 * through its Payment Intents API); the storefront never sees card data and never models capture itself. The server
 * only creates the session for a prepared cart, asks for a cancel (release) or a refund when an order is cancelled, and
 * manages stored methods.
 *
 * Two implementations: `checkout-provider.ts` (the real Checkout adapter) and `fake-provider.ts` (dev/test only,
 * `MALVA_FIXTURES=1`, never in production). Everything else depends on this interface.
 */

export interface PaymentCartRef {
  id: string;
  total: { centAmount: number; currencyCode: string };
}

/** What the demo provider holds for a cart (the real provider keeps this on the commercetools Payment, never here). */
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
  /** A Checkout session for a cart that `prepareCheckout` has gated (the SDK reads the amount from the cart). */
  createSession(cart: PaymentCartRef): Promise<PaymentSessionInfo>;
  /**
   * Cancels an authorization that was never captured (Payment Intents `cancelPayment`): the order is cancelled or
   * refused. The buyer's money was only held, so the page says "Payment released". Idempotent for the caller (it skips
   * a payment that already carries a cancellation).
   */
  release(paymentId: string): Promise<void>;
  /** Refunds a captured amount (Payment Intents `refundPayment`). The connector moves the Refund transaction on. */
  refund(paymentId: string, amount: { centAmount: number; currencyCode: string }): Promise<void>;
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

/** The payment service is not configured or unreachable. The message is safe to show. */
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
