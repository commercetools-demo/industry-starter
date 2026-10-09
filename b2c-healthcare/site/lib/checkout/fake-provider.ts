import 'server-only';
import { StoredMethodNotFoundError, type AuthorizationState, type PaymentCartRef, type PaymentProvider, type StoredMethodDescriptor } from './payment-provider';

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
  /** Records the demo "Checkout" payment (or a decline) for the cart at the amount the card must pay. */
  authorize(cart: PaymentCartRef, options?: { decline?: boolean }): AuthorizationState;
  /** Test helper: a saved card for a customer (descriptor only: there is no card number anywhere in the fake). */
  addStoredMethod(customerId: string, card: { brand: string; last4: string; expMonth?: number; expYear?: number; isDefault?: boolean }): StoredMethodDescriptor;
  /** Test helper: forget everything. */
  reset(): void;
  /** Test helper: payment ids released so far. */
  readonly released: readonly string[];
  /** Test helper: refunds requested so far. */
  readonly refunded: readonly { paymentId: string; centAmount: number }[];
}

export function createFakePaymentProvider(): FakePaymentProvider {
  const held = new Map<string, Held>();
  const released: string[] = [];
  const refunded: { paymentId: string; centAmount: number }[] = [];
  // On globalThis: in `next dev` the account pages and the route handlers are separate bundles, each with its own module copy.
  const g = globalThis as unknown as { __malvaFakeStoredMethods?: Map<string, (StoredMethodDescriptor & { customerId: string })[]> };
  const stored = (g.__malvaFakeStoredMethods ??= new Map<string, (StoredMethodDescriptor & { customerId: string })[]>());
  let seq = 0;
  const mine = (customerId: string) => stored.get(customerId) ?? [];
  const strip = (m: StoredMethodDescriptor & { customerId: string }): StoredMethodDescriptor => ({ id: m.id, brand: m.brand, last4: m.last4, expMonth: m.expMonth, expYear: m.expYear, isDefault: m.isDefault });

  const stateOf = (h: Held | undefined): AuthorizationState => {
    if (!h || h.status === 'released') return { status: 'none' };
    if (h.status === 'declined') return { status: 'declined', paymentId: h.paymentId };
    return { status: 'authorized', paymentId: h.paymentId, centAmount: h.centAmount, currencyCode: h.currencyCode };
  };

  return {
    kind: 'demo',
    released,
    refunded,
    async createSession(cart) {
      return { sessionId: `demo-session-${cart.id}`, projectKey: 'demo', region: 'demo' };
    },
    async refund(paymentId, amount) {
      refunded.push({ paymentId, centAmount: amount.centAmount });
    },
    async release(paymentId) {
      for (const h of held.values()) {
        if (h.paymentId === paymentId) h.status = 'released';
      }
      // Idempotent: a payment is released once, whether the demo held it or a test payment stands for it.
      if (!released.includes(paymentId)) released.push(paymentId);
    },
    async listStoredMethods(customerId) {
      const all = mine(customerId).map(strip);
      return [...all.filter((m) => m.isDefault), ...all.filter((m) => !m.isDefault)];
    },
    async setDefaultStoredMethod(customerId, methodId) {
      const list = mine(customerId);
      if (!list.some((m) => m.id === methodId)) throw new StoredMethodNotFoundError();
      // Same semantics as the real adapter: the previous default is cleared explicitly.
      for (const m of list) m.isDefault = m.id === methodId;
    },
    async removeStoredMethod(customerId, methodId) {
      const list = mine(customerId);
      if (!list.some((m) => m.id === methodId)) throw new StoredMethodNotFoundError();
      stored.set(customerId, list.filter((m) => m.id !== methodId));
    },
    addStoredMethod(customerId, card) {
      seq += 1;
      const entry = { id: `demo-pm-${seq}`, customerId, brand: card.brand, last4: card.last4, expMonth: card.expMonth ?? 12, expYear: card.expYear ?? 2030, isDefault: card.isDefault ?? mine(customerId).length === 0 };
      stored.set(customerId, [...mine(customerId).map((m) => (entry.isDefault ? { ...m, isDefault: false } : m)), entry]);
      return strip(entry);
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
      stored.clear();
      held.clear();
      released.length = 0;
      refunded.length = 0;
    },
  };
}

/** The process-wide demo provider (in memory, like the fixture cart). */
export const fakePaymentProvider: FakePaymentProvider = createFakePaymentProvider();
