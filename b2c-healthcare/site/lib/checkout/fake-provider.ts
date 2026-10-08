import 'server-only';
import type { AuthorizationState, PaymentCartRef, PaymentProvider } from './payment-provider';

/**
 * DEMO PAYMENT PROVIDER: development and tests only.
 *
 * There is no payment service account yet (OA-04), so this stand-in keeps "authorizations" in memory. It is loaded
 * only through `loadFakePaymentProvider` (lib/ct/fixtures.ts), which returns null in production and unless
 * `MALVA_FIXTURES=1`; the checkout page then shows the banner "DEMO payment (no PSP configured)". No card data
 * exists anywhere here: "authorizing" records an amount, optionally as declined. Nothing is charged.
 */

interface Held {
  paymentId: string;
  status: 'authorized' | 'declined' | 'released';
  centAmount: number;
  currencyCode: string;
}

export interface FakePaymentProvider extends PaymentProvider {
  readonly kind: 'demo';
  /** Records an authorization (or a decline) for the cart at the amount it has now. */
  authorize(cart: PaymentCartRef, options?: { decline?: boolean }): AuthorizationState;
  /** Test helper: forget everything. */
  reset(): void;
  /** Test helper: payment ids released so far. */
  readonly released: readonly string[];
}

export function createFakePaymentProvider(): FakePaymentProvider {
  const held = new Map<string, Held>();
  const released: string[] = [];
  let seq = 0;

  const stateOf = (h: Held | undefined): AuthorizationState => {
    if (!h || h.status === 'released') return { status: 'none' };
    if (h.status === 'declined') return { status: 'declined', paymentId: h.paymentId };
    return { status: 'authorized', paymentId: h.paymentId, centAmount: h.centAmount, currencyCode: h.currencyCode };
  };

  return {
    kind: 'demo',
    released,
    async createSession(cart) {
      return { sessionId: `demo-session-${cart.id}`, projectKey: 'demo', region: 'demo' };
    },
    async getAuthorization(cartId) {
      return stateOf(held.get(cartId));
    },
    async release(paymentId) {
      for (const h of held.values()) {
        if (h.paymentId === paymentId && h.status !== 'released') {
          h.status = 'released';
          released.push(paymentId);
        }
      }
    },
    authorize(cart, options = {}) {
      seq += 1;
      const entry: Held = {
        paymentId: `demo-payment-${seq}`,
        status: options.decline ? 'declined' : 'authorized',
        centAmount: cart.total.centAmount,
        currencyCode: cart.total.currencyCode,
      };
      held.set(cart.id, entry);
      return stateOf(entry);
    },
    reset() {
      held.clear();
      released.length = 0;
    },
  };
}

/** The process-wide demo provider (in memory, like the fixture cart). */
export const fakePaymentProvider: FakePaymentProvider = createFakePaymentProvider();
