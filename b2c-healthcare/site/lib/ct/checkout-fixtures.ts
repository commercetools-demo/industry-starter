import 'server-only';
import { isBeforeSameDayCutoff, SAME_DAY_METHOD_KEY, STANDARD_METHOD_KEY } from '@/lib/checkout/config';
import type { PaymentProvider } from '@/lib/checkout/payment-provider';
import type { CheckoutContext, MethodOutcome } from '@/lib/ct/checkout';
import type { PlaceOrderInput, PlaceOrderOutcome } from '@/lib/ct/orders';
import * as cartFixtures from '@/lib/ct/cart-fixtures';
import type { OrderView } from '@/lib/order-types';
import type { AddressInput, CheckoutState, DeliveryOption, Money } from '@/lib/types';

/**
 * Development-only checkout (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts): the address and delivery method live in
 * memory next to the fixture cart, so the checkout page can be checked in a browser without commercetools. It
 * imitates the platform's answer, including the arithmetic, only because there is no platform; the production path
 * never computes a total. Never loaded in production.
 */

interface Held {
  address: AddressInput | null;
  methodKey: string;
}
const held = new Map<string, Held>();
const zero = (): Money => ({ centAmount: 0, currencyCode: 'USD', fractionDigits: 2 });
const SAME_DAY_STATES = ['NY', 'TX', 'IL'];
const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });

const holdFor = (customerId: string): Held => {
  let h = held.get(customerId);
  if (!h) {
    h = { address: null, methodKey: STANDARD_METHOD_KEY };
    held.set(customerId, h);
  }
  return h;
};

function optionsFor(h: Held, now: Date): DeliveryOption[] {
  const options: DeliveryOption[] = [{ key: STANDARD_METHOD_KEY, name: 'Standard delivery', price: zero() }];
  if (h.address && SAME_DAY_STATES.includes(h.address.state) && isBeforeSameDayCutoff(now)) options.push({ key: SAME_DAY_METHOD_KEY, name: 'Same-day delivery', price: usd(500) });
  return options;
}

async function state(ctx: CheckoutContext): Promise<CheckoutState | null> {
  const cart = await cartFixtures.getCartValidated(ctx.patient, ctx.customerId, ctx.rx);
  if (!cart) return null;
  const h = holdFor(ctx.customerId);
  const options = optionsFor(h, ctx.now);
  if (!options.some((o) => o.key === h.methodKey)) h.methodKey = STANDARD_METHOD_KEY;
  const chosen = options.find((o) => o.key === h.methodKey) ?? options[0];
  const subtotal = cart.subtotal?.centAmount ?? 0;
  return {
    cart: {
      ...cart,
      shipping: { name: chosen.name, price: chosen.price },
      total: usd(subtotal + chosen.price.centAmount),
      shippingAddress: h.address,
      shippingMethodKey: chosen.key,
      tax: zero(),
    },
    options,
    deliverable: true,
    paymentMode: 'demo',
  };
}

export const readCheckout = (ctx: CheckoutContext): Promise<CheckoutState | null> => state(ctx);

export async function setAddress(ctx: CheckoutContext, input: AddressInput): Promise<CheckoutState | null> {
  holdFor(ctx.customerId).address = input;
  return state(ctx);
}

export async function setShippingMethod(ctx: CheckoutContext, key: string): Promise<MethodOutcome | null> {
  const before = await state(ctx);
  if (!before) return null;
  if (!before.options.some((o) => o.key === key)) return { state: before, accepted: false };
  holdFor(ctx.customerId).methodKey = key;
  const next = await state(ctx);
  return next ? { state: next, accepted: true } : null;
}

// ---------------------------------------------------------------- placing an order (fixtures only)

const placed = new Map<string, PlaceOrderOutcome>();
// On globalThis: the route handlers that place and cancel and the pages that read are separate bundles in `next dev`.
const orderStore = globalThis as unknown as { __malvaFixtureOrders?: Map<string, { customerId: string; view: OrderView }> };
const fixtureOrders = (orderStore.__malvaFixtureOrders ??= new Map());
let orderSeq = 0;

type Total = { centAmount: number; currencyCode: string };
const sameTotal = (a: Total, b: Total) => a.centAmount === b.centAmount && a.currencyCode === b.currencyCode;

/**
 * Same decisions as `lib/ct/orders.ts` placeOrder, against the in-memory cart and the fake provider: lines,
 * totals vs. the amount shown and the authorized amount, once per idempotency key. It writes nothing to
 * commercetools and does not consume refills (fixtures are not a ledger). Never loaded in production.
 */
export async function placeOrder(input: PlaceOrderInput, provider: PaymentProvider): Promise<PlaceOrderOutcome> {
  const { ctx, expectedTotal, idempotencyKey } = input;
  const prior = placed.get(idempotencyKey);
  if (prior) return prior;
  const state = await readCheckout(ctx);
  if (!state || state.cart.lineCount === 0) return { ok: false, code: 'EMPTY_CART' };
  if (!state.cart.shippingAddress) return { ok: false, code: 'ADDRESS_MISSING' };
  const bad = state.cart.lines.filter((l) => l.unavailable).map((l) => l.id);
  if (bad.length > 0) return { ok: false, code: 'LINES_UNAVAILABLE', lineIds: bad };
  const total = state.cart.total;
  const auth = await provider.getAuthorization(state.cart.id);
  if (!sameTotal(total, expectedTotal)) {
    if (auth.status === 'authorized' && !sameTotal(total, auth)) await provider.release(auth.paymentId);
    return { ok: false, code: 'TOTALS_MOVED' };
  }
  if (auth.status === 'none') return { ok: false, code: 'PAYMENT_REQUIRED' };
  if (auth.status === 'declined') return { ok: false, code: 'PAYMENT_DECLINED' };
  if (!sameTotal(total, auth)) {
    await provider.release(auth.paymentId);
    return { ok: false, code: 'TOTALS_MOVED' };
  }
  orderSeq += 1;
  const a = state.cart.shippingAddress;
  const view: OrderView = {
    id: `fixture-order-${orderSeq}`,
    orderNumber: `MLV-${String(orderSeq).padStart(6, '0')}`,
    status: 'received',
    shipmentState: null,
    createdAt: ctx.now.toISOString(),
    lines: state.cart.lines.map((l) => ({ name: l.name['en-US'] ?? Object.values(l.name)[0] ?? '', quantity: l.prescribedQty })),
    deliverTo: `${a.street}, ${a.city}, ${a.state} ${a.zip}`,
    sameDay: state.cart.shippingMethodKey === SAME_DAY_METHOD_KEY,
    total,
    refund: 'none',
    cancellable: true,
  };
  fixtureOrders.set(view.id, { customerId: ctx.customerId, view });
  cartFixtures.clearCart(ctx.customerId);
  held.delete(ctx.customerId);
  const outcome: PlaceOrderOutcome = { ok: true, replay: false, orderId: `fixture-order-${orderSeq}`, orderNumber: `MLV-${String(orderSeq).padStart(6, '0')}` };
  placed.set(idempotencyKey, { ...outcome, replay: true });
  return outcome;
}

// ---------------------------------------------------------------- reading orders back (fixtures only)

/** An order placed in this process, only for its own customer (a foreign id is as good as unknown). */
export function fixtureOrder(id: string, customerId: string): OrderView | null {
  const held = fixtureOrders.get(id);
  return held && held.customerId === customerId ? held.view : null;
}

export const fixtureOrderList = (customerId: string): OrderView[] =>
  [...fixtureOrders.values()].filter((o) => o.customerId === customerId).map((o) => o.view).reverse();

/** QA only: moves a fixture order to a state (`?`-less, no route): used by tests and by hand in a dev shell. */
export function setFixtureOrderState(id: string, patch: Partial<Pick<OrderView, 'status' | 'shipmentState' | 'refund' | 'cancellable'>>): void {
  const held = fixtureOrders.get(id);
  if (held) held.view = { ...held.view, ...patch };
}

/** Cancel in fixtures: same rule as the platform path (only before packed-shipped); no ledger or payment to touch. */
export function cancelFixtureOrder(id: string, customerId: string): { kind: 'not-found' } | { kind: 'too-late' } | { kind: 'cancelled'; order: OrderView; alreadyCancelled: boolean } {
  const held = fixtureOrders.get(id);
  if (!held || held.customerId !== customerId) return { kind: 'not-found' };
  if (held.view.status === 'cancelled') return { kind: 'cancelled', order: held.view, alreadyCancelled: true };
  if (!held.view.cancellable) return { kind: 'too-late' };
  held.view = { ...held.view, status: 'cancelled', cancellable: false, refund: 'requested' };
  return { kind: 'cancelled', order: held.view, alreadyCancelled: false };
}
