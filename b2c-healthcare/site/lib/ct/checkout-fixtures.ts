import 'server-only';
import { isBeforeSameDayCutoff, SAME_DAY_METHOD_KEY, STANDARD_METHOD_KEY } from '@/lib/checkout/config';
import { drawdown } from '@/lib/ct/allowance';
import { allocateTender } from '@/lib/funding/tender';
import type { CheckoutContext, MethodOutcome, RestrictedOutcome } from '@/lib/ct/checkout';
import type { FinalizeOutcome, PrepareInput, PrepareOutcome } from '@/lib/ct/orders';
import * as cartFixtures from '@/lib/ct/cart-fixtures';
import type { Instrument, OrderView } from '@/lib/order-types';
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
  const funded = {
    ...cart,
    shipping: { name: chosen.name, price: chosen.price },
    total: usd(subtotal + chosen.price.centAmount),
    ...(cart.youOwe ? { youOwe: usd(subtotal + chosen.price.centAmount) } : {}),
    shippingAddress: h.address,
    shippingMethodKey: chosen.key,
    tax: zero(),
  };
  const { fixtureTenderView } = await import('@/lib/ct/funding-fixtures');
  return {
    cart: { ...funded, tender: await fixtureTenderView(funded, ctx.customerId, ctx.patient.patientRef, ctx.now) },
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

export async function setRestricted(ctx: CheckoutContext, on: boolean): Promise<RestrictedOutcome | null> {
  const before = await state(ctx);
  if (!before) return null;
  const { setFixtureRestrictedChoice } = await import('@/lib/ct/funding-fixtures');
  if (on && !before.cart.lines.some((l) => l.eligibleForRestricted)) return { ok: false, reason: 'none-eligible', state: before };
  setFixtureRestrictedChoice(ctx.customerId, on);
  const next = await state(ctx);
  return next ? { ok: true, state: next } : null;
}

// ---------------------------------------------------------------- the gate, Checkout and finalize (fixtures only)

// On globalThis: the route handlers that prepare, complete and cancel and the pages that read are separate bundles in `next dev`.
interface FixtureOrder {
  customerId: string;
  patientRef: string;
  view: OrderView;
  plan: { allowance: number; restricted: number; card: number };
  settlements: { id: string; eligible: boolean; amount: number }[];
  finalized: boolean;
}
const orderStore = globalThis as unknown as { __malvaFixtureOrders?: Map<string, FixtureOrder>; __malvaFixturePrepared?: Map<string, { state: CheckoutState; plan: FixtureOrder['plan']; now: Date; patientRef: string }>; __malvaFixtureSeq?: { n: number } };
const fixtureOrders: Map<string, FixtureOrder> = (orderStore.__malvaFixtureOrders ??= new Map());
const prepared: NonNullable<typeof orderStore.__malvaFixturePrepared> = (orderStore.__malvaFixturePrepared ??= new Map());
const seq = (orderStore.__malvaFixtureSeq ??= { n: 0 });

type Total = { centAmount: number; currencyCode: string };
const sameTotal = (a: Total, b: Total) => a.centAmount === b.centAmount && a.currencyCode === b.currencyCode;

/**
 * Same decisions as `lib/ct/orders.ts` prepareCheckout, against the in-memory cart: lines, cover, the total against the
 * amount shown. It writes nothing to commercetools. A card remainder of 0 creates and finalizes the order here, like
 * production; otherwise the demo provider stands in for Checkout (`createFixtureOrder`). Never loaded in production.
 */
export async function prepareFixture(input: PrepareInput): Promise<PrepareOutcome> {
  const { ctx, expectedTotal } = input;
  const state = await readCheckout(ctx);
  if (!state || state.cart.lineCount === 0) return { ok: false, code: 'EMPTY_CART' };
  if (!state.cart.shippingAddress) return { ok: false, code: 'ADDRESS_MISSING' };
  if (state.cart.unresolved) return { ok: false, code: 'COVER_UNRESOLVED' };
  const bad = state.cart.lines.filter((l) => l.unavailable).map((l) => l.id);
  if (bad.length > 0) return { ok: false, code: 'LINES_UNAVAILABLE', lineIds: bad };
  if (!sameTotal(state.cart.total, expectedTotal)) return { ok: false, code: 'TOTALS_MOVED' };
  const { fixturePlan } = await import('@/lib/ct/funding-fixtures');
  const plan = await fixturePlan(state.cart, ctx.customerId, ctx.patient.patientRef, ctx.now);
  prepared.set(ctx.customerId, { state, plan, now: ctx.now, patientRef: ctx.patient.patientRef });
  if (plan.card === 0) {
    const order = createFixtureOrder(ctx.customerId);
    if (!order) return { ok: false, code: 'PLACEMENT_FAILED' };
    const done = await finalizeFixtureOrder(order.id);
    return done.ok ? { ok: true, kind: 'order', orderId: done.orderId, orderNumber: done.orderNumber } : { ok: false, code: done.code === 'FUNDING_CHANGED' ? 'FUNDING_CHANGED' : 'PLACEMENT_FAILED' };
  }
  return { ok: true, kind: 'demo', cardDue: plan.card };
}

/**
 * DEMO "Checkout creates the order": what the full Checkout does after the card is authorized. Creates the order from
 * the prepared cart without a number or settlement and leaves the domain work to `finalizeFixtureOrder`, which the
 * completion callback (or a lazy read) runs. Null when `prepareFixture` did not run for this customer.
 */
export function createFixtureOrder(customerId: string): { id: string } | null {
  const p = prepared.get(customerId);
  if (!p) return null;
  const { state, plan } = p;
  seq.n += 1;
  const id = `fixture-order-${seq.n}`;
  const a = state.cart.shippingAddress!;
  const view: OrderView = {
    id,
    orderNumber: '',
    status: 'received',
    shipmentState: null,
    createdAt: p.now.toISOString(),
    lines: state.cart.lines.map((l) => ({ name: l.name['en-US'] ?? Object.values(l.name)[0] ?? '', quantity: l.prescribedQty, eligible: l.eligibleForRestricted === true, settledBy: [] })),
    deliverTo: `${a.street}, ${a.city}, ${a.state} ${a.zip}`,
    sameDay: state.cart.shippingMethodKey === SAME_DAY_METHOD_KEY,
    total: state.cart.total,
    refund: 'none',
    cancellable: true,
  };
  fixtureOrders.set(id, { customerId, patientRef: p.patientRef, view, plan, settlements: state.cart.lines.map((l) => ({ id: l.id, eligible: l.eligibleForRestricted === true, amount: l.totalPrice.centAmount })), finalized: false });
  prepared.delete(customerId);
  return { id };
}

/** The domain logic once per order id (idempotent: a second call answers with the same number). Fixtures consume no refills (not a ledger). */
export async function finalizeFixtureOrder(orderId: string): Promise<FinalizeOutcome> {
  const entry = fixtureOrders.get(orderId);
  if (!entry) return { ok: false, code: 'NOT_FOUND' };
  if (entry.finalized) return { ok: true, replay: true, orderId, orderNumber: entry.view.orderNumber };
  const { plan, view } = entry;
  // The allowance draw is idempotent on the order id, like production (the in-memory store has the same version rules).
  let allowanceApplied = 0;
  if (plan.allowance > 0) {
    allowanceApplied = (await drawdown(entry.patientRef, orderId, plan.allowance, new Date(view.createdAt))).applied;
    if (allowanceApplied < plan.allowance) {
      entry.view = { ...view, status: 'cancelled', cancellable: false };
      entry.finalized = true;
      return { ok: false, code: 'FUNDING_CHANGED' };
    }
  }
  const settlements = allocateTender(entry.settlements, { ...plan, allowance: allowanceApplied });
  const orderNumber = `MLV-${String(Number(orderId.replace('fixture-order-', ''))).padStart(6, '0')}`;
  entry.view = {
    ...view,
    orderNumber,
    lines: view.lines.map((l, i) => ({ ...l, settledBy: (['allowance', 'restricted', 'card'] as const).filter((k) => settlements[i]![k] > 0).map((k): Instrument => (k === 'restricted' ? 'restricted-health-account' : k)) })),
    ...(plan.allowance > 0 || plan.restricted > 0 ? { tender: { allowance: usd(allowanceApplied), restricted: usd(plan.restricted), card: usd(plan.card) } } : {}),
  };
  entry.finalized = true;
  const { setFixtureRestrictedChoice } = await import('@/lib/ct/funding-fixtures');
  setFixtureRestrictedChoice(entry.customerId, false);
  cartFixtures.clearCart(entry.customerId);
  held.delete(entry.customerId);
  return { ok: true, replay: false, orderId, orderNumber };
}

// ---------------------------------------------------------------- reading orders back (fixtures only)

/** An order placed in this process, only for its own customer (a foreign id is as good as unknown). */
export function fixtureOrder(id: string, customerId: string): OrderView | null {
  const held = fixtureOrders.get(id);
  return held && held.customerId === customerId ? held.view : null;
}

export const fixtureOrderList = (customerId: string): OrderView[] =>
  [...fixtureOrders.values()].filter((o) => o.customerId === customerId && o.finalized).map((o) => o.view).reverse();

/** The customer of a fixture order, for the completion callback's ownership check. */
export const fixtureOrderOwner = (id: string): string | null => fixtureOrders.get(id)?.customerId ?? null;

/** QA only: moves a fixture order to a state (`?`-less, no route): used by tests and by hand in a dev shell. */
export function setFixtureOrderState(id: string, patch: Partial<Pick<OrderView, 'status' | 'shipmentState' | 'refund' | 'cancellable'>>): void {
  const held = fixtureOrders.get(id);
  if (held) held.view = { ...held.view, ...patch };
}

/** Cancel in fixtures: same rule as the platform path (only before packed-shipped); no ledger or payment to touch. */
export async function cancelFixtureOrder(id: string, customerId: string): Promise<{ kind: 'not-found' } | { kind: 'too-late' } | { kind: 'cancelled'; order: OrderView; alreadyCancelled: boolean }> {
  const held = fixtureOrders.get(id);
  if (!held || held.customerId !== customerId) return { kind: 'not-found' };
  if (held.view.status === 'cancelled') return { kind: 'cancelled', order: held.view, alreadyCancelled: true };
  if (!held.view.cancellable) return { kind: 'too-late' };
  held.view = { ...held.view, status: 'cancelled', cancellable: false, refund: held.plan.card > 0 ? 'released' : 'none' };
  const { restoreAllowance } = await import('@/lib/ct/allowance');
  await restoreAllowance(id);
  return { kind: 'cancelled', order: held.view, alreadyCancelled: false };
}
