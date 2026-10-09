import 'server-only';
import type { Cart as CtCart, CartUpdateAction, Order, OrderUpdateAction } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import { ORDER_STATE_RECEIVED } from '@/lib/checkout/config';
import { PaymentUnavailableError, type PaymentProvider } from '@/lib/checkout/payment-provider';
import { apiRoot } from '@/lib/ct/client';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';
import type { CheckoutContext } from '@/lib/ct/checkout';
import { refreshFunding } from '@/lib/ct/cart-funding';
import { consumeLinesOf } from '@/lib/ct/auto-refill-run';
import { CONTAINERS, createOnly, deleteObject, getObject, putObject, statusOf } from '@/lib/ct/custom-objects';
import { restoreAllowance } from '@/lib/ct/allowance';
import { consumeAuthorization, DispenseRefusedError, restoreAuthorization } from '@/lib/ct/dispense-ledger';
import { nextOrderNumber } from '@/lib/ct/order-number';
import { returnCardPayments } from '@/lib/ct/payment-lifecycle';
import { getPatient } from '@/lib/ct/patient';
import { findOwnPrescription, RxNotFoundError, validateRxSelection } from '@/lib/ct/prescriptions';
import { getOptionsForCart } from '@/lib/ct/shipping-options';
import { ensureTenderPayments, planFor, planFromOrder, settleTender } from '@/lib/ct/tender';
import { buildLineRecord, toLineCustomFields } from '@/lib/dispense/line-record';
import { log } from '@/lib/log';
import { mapCartAddress, mapCheckoutCart } from '@/lib/mappers/checkout';
import { rxFieldsOf } from '@/lib/mappers/cart';
import { paymentsOf } from '@/lib/mappers/order';
import type { PlaceOrderFailure, PlacedOrder, PrepareResult } from '@/lib/types';

/**
 * Orders in the full-Checkout design (D-034, follow-up AA). Two halves, because commercetools Checkout - not the
 * storefront - creates the order from the cart once the payment is authorized:
 *
 *  1. `prepareCheckout` (the gate, before Checkout runs): re-validates every line (N prescription rules, U credentials),
 *     re-resolves the payer cost-share (U), compares the cart total with what the buyer saw, writes the N-09 line
 *     records onto the cart lines (the platform copies them to the order lines), puts the allowance / restricted
 *     instrument Payments on the cart (U) and then creates the Checkout session for the card remainder. When nothing is
 *     left for the card the storefront creates the order itself and finalizes it.
 *  2. `finalizeOrder(orderId)` (after the order exists, however it came to exist): the domain logic that must happen
 *     exactly once per order - prescription consumption, allowance draw, the `MLV-` number (only if unset) and the
 *     `mlv-received` state. Idempotent on the order id: a lock/record per order, every step idempotent. It runs from the
 *     browser's `checkout_completed` callback, lazily when the order is read (S), and from a secret-guarded route for a
 *     commercetools subscription (OrderCreated). Whoever gets there first does the work; the others get the same answer.
 *
 * The storefront never models capture: Checkout and the connector own the payment lifecycle (D-035). Totals are the
 * cart's; nothing here adds a price. Health-data rule: no RX number, medication or address reaches a log line.
 */

export interface PrepareInput {
  ctx: CheckoutContext;
  /** The cart the session holds. */
  cartId: string;
  /** The total the buyer was shown (cents + currency): Checkout is started only if the cart still says this. */
  expectedTotal: { centAmount: number; currencyCode: string };
}

export type PrepareOutcome = ({ ok: true } & PrepareResult) | { ok: false; code: PlaceOrderFailure; lineIds?: string[] };

export type FinalizeOutcome =
  | ({ ok: true; replay: boolean } & PlacedOrder)
  | { ok: false; code: 'NOT_FOUND' | 'IN_PROGRESS' | 'DISPENSE_REFUSED' | 'FUNDING_CHANGED' | 'PLACEMENT_FAILED' };

interface FinalizeRecord {
  state: 'pending' | 'done' | 'refused';
  at: string;
  orderNumber?: string;
  code?: 'DISPENSE_REFUSED' | 'FUNDING_CHANGED';
}

/** A pending finalize older than this is treated as crashed and may be taken over. */
const STALE_PENDING_MS = 2 * 60 * 1000;
const ORDER_ID = /^[\w-]{1,64}$/;
const ORDER_EXPAND = ['state', 'paymentInfo.payments[*]'];
const finalizeKey = (orderId: string) => `fin-${orderId}`;

const fail = (code: PlaceOrderFailure, lineIds?: string[]): PrepareOutcome => ({ ok: false, code, ...(lineIds ? { lineIds } : {}) });
const sameTotal = (a: { centAmount: number; currencyCode: string }, b: { centAmount: number; currencyCode: string }) => a.centAmount === b.centAmount && a.currencyCode === b.currencyCode;

async function readCart(cartId: string): Promise<CtCart | null> {
  try {
    const { body } = await apiRoot.carts().withId({ ID: cartId }).get({ queryArgs: { expand: ['shippingInfo.shippingMethod'] } }).execute();
    return body;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

async function readOrder(orderId: string): Promise<Order | null> {
  try {
    const { body } = await apiRoot.orders().withId({ ID: orderId }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute();
    return body;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

async function findOrderForCart(cartId: string): Promise<Order | null> {
  const { body } = await apiRoot.orders().get({ queryArgs: { where: `cart(id="${cartId}")`, limit: 1, expand: ORDER_EXPAND } }).execute();
  return body.results[0] ?? null;
}

// ---------------------------------------------------------------- 1. the gate

interface Prepared {
  actions: CartUpdateAction[];
}

/** Re-runs the prescription rules for every line and builds the line records the order needs (N-09, U credentials). */
async function prepareLines(ctx: CheckoutContext, cart: CtCart): Promise<Prepared | { failed: PrepareOutcome }> {
  const byRx = new Map<string, { id: string; lineRef: string }[]>();
  const unavailable: string[] = [];
  for (const item of cart.lineItems) {
    const f = rxFieldsOf(item);
    if (!f) unavailable.push(item.id);
    else byRx.set(f.rxNumber, [...(byRx.get(f.rxNumber) ?? []), { id: item.id, lineRef: f.rxLineRef }]);
  }
  const actions: CartUpdateAction[] = [];
  for (const [rxNumber, group] of byRx) {
    try {
      const result = await validateRxSelection(ctx.patient, rxNumber, group.map((g) => g.lineRef), ctx.rx);
      for (const row of result.refused) for (const g of group.filter((x) => x.lineRef === row.lineRef)) unavailable.push(g.id);
      const rx = await findOwnPrescription(ctx.patient.patientRef, rxNumber);
      for (const accepted of result.accepted) {
        const prescribed = rx?.lines.find((l) => l.lineRef === accepted.lineRef);
        const lineId = group.find((g) => g.lineRef === accepted.lineRef)?.id;
        if (!rx || !prescribed || !lineId) {
          if (lineId) unavailable.push(lineId);
          continue;
        }
        // The authorization as it stands NOW, before the consumption in `finalizeOrder`: copied onto the order line (N-09).
        const fields = toLineCustomFields(buildLineRecord(rx, prescribed, accepted.qty));
        for (const name of ['dispensedQty', 'authorizationParams', 'suppliedLots'] as const) {
          actions.push({ action: 'setLineItemCustomField', lineItemId: lineId, name, value: fields[name] });
        }
        // The credential that allowed a controlled line, as checked now: its id and expiry are copied, not referenced (workstream U).
        if (accepted.credential) {
          actions.push({ action: 'setLineItemCustomField', lineItemId: lineId, name: 'credentialRef', value: accepted.credential.id });
          actions.push({ action: 'setLineItemCustomField', lineItemId: lineId, name: 'credentialValidTo', value: accepted.credential.validTo });
        }
      }
    } catch (error) {
      if (!(error instanceof RxNotFoundError)) throw error;
      for (const g of group) unavailable.push(g.id);
    }
  }
  if (unavailable.length > 0) return { failed: fail('LINES_UNAVAILABLE', [...new Set(unavailable)]) };
  return { actions };
}

/** The non-cancelled order the cart already became (a retry after success, or after a lost response). */
async function existingOrder(cartId: string): Promise<Order | null> {
  const order = await findOrderForCart(cartId);
  return order && order.state?.obj?.key !== 'mlv-cancelled' ? order : null;
}

/**
 * The pre-checkout gate. Returns what the page does next (`PrepareResult`) or the reason nothing may start. Safe to call
 * again (every step is idempotent: same line records, same tender Payments, a new session for the same cart). No order
 * exists after a refusal and the cart is kept.
 */
export async function prepareCheckout(input: PrepareInput, provider: PaymentProvider): Promise<PrepareOutcome> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.prepareFixture(input);
  const { ctx, cartId, expectedTotal } = input;

  let cart = await readCart(cartId);
  if (!cart || cart.customerId !== ctx.customerId) return fail('EMPTY_CART');
  if (cart.cartState === 'Ordered') {
    // Checkout (or an earlier call) already made the order: make sure it is finalized and hand it back.
    const order = await existingOrder(cart.id);
    if (!order) return fail('EMPTY_CART');
    const done = await finalizeOrder(order.id, { provider });
    return done.ok ? { ok: true, kind: 'order', orderId: done.orderId, orderNumber: done.orderNumber } : fail(done.code === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PLACEMENT_FAILED');
  }
  if (cart.cartState !== 'Active' || cart.lineItems.length === 0) return fail('EMPTY_CART');
  // Payer cost-share again, now (U-03): the split the buyer saw may be stale. Unresolved never defaults to the list
  // price; a changed split changes the total, which the comparison below refuses with the new figures on the cart.
  const funding = await refreshFunding(cart, ctx.patient);
  if (funding.unresolved) return fail('COVER_UNRESOLVED');
  if (funding.changed) cart = (await readCart(cart.id)) ?? cart;
  if (!mapCartAddress(cart.shippingAddress)) return fail('ADDRESS_MISSING');
  const methodKey = cart.shippingInfo?.shippingMethod?.obj?.key;
  if (!cart.shippingInfo || !methodKey) return fail('NO_DELIVERY_METHOD');
  // The method must still be one the platform offers for this cart now (same-day closes at 14:00 New York).
  if (!(await getOptionsForCart(cart.id, ctx.now)).some((o) => o.key === methodKey)) return fail('NO_DELIVERY_METHOD');

  // Totals: only from the cart. What the card must pay is the tender plan's remainder (allowance, then restricted instrument, then card).
  const cartTotal = mapCheckoutCart(cart).total;
  if (!sameTotal(cartTotal, expectedTotal)) return fail('TOTALS_MOVED');
  const { plan } = await planFor(cart, { patientRef: ctx.patient.patientRef, now: ctx.now });

  const prepared = await prepareLines(ctx, cart);
  if ('failed' in prepared) return prepared.failed;

  let updated: CtCart;
  try {
    updated = await withCartRetry(async () => {
      const current = (await readCart(cart.id)) ?? cart;
      if (prepared.actions.length === 0) return current;
      const { body } = await apiRoot.carts().withId({ ID: current.id }).post({ body: { version: current.version, actions: prepared.actions } }).execute();
      return body;
    });
    if (!sameTotal(mapCheckoutCart(updated).total, expectedTotal)) return fail('TOTALS_MOVED');
    // The tender Payments go on the cart BEFORE Checkout runs: Checkout then only has the card remainder to collect.
    await ensureTenderPayments(cart.id, plan);
  } catch (error) {
    log.error('checkout', 'could not prepare the cart', error instanceof Error ? error : { name: typeof error });
    return fail('PLACEMENT_FAILED');
  }

  const cardDue = plan.card;
  if (cardDue === 0) {
    // Nothing for the card: Checkout has nothing to authorize, so the storefront creates the order itself (the one
    // order the storefront still creates) and finalizes it like any other.
    const placed = await createOrderFromCart(cart.id, ctx.now, provider);
    return placed.ok ? { ok: true, kind: 'order', orderId: placed.orderId, orderNumber: placed.orderNumber } : fail(placed.code);
  }
  try {
    const session = await provider.createSession({ id: cart.id, total: { centAmount: cardDue, currencyCode: cartTotal.currencyCode } });
    return provider.kind === 'demo' ? { ok: true, kind: 'demo', cardDue } : { ok: true, kind: 'checkout', session, cardDue };
  } catch (error) {
    if (error instanceof PaymentUnavailableError) throw error;
    log.error('checkout', 'could not create the checkout session', error instanceof Error ? error : { name: typeof error });
    return fail('PLACEMENT_FAILED');
  }
}

/** Creates the order for a cart whose tender Payments cover it completely, then finalizes it. */
async function createOrderFromCart(cartId: string, now: Date, provider: PaymentProvider): Promise<({ ok: true } & PlacedOrder) | { ok: false; code: PlaceOrderFailure }> {
  let order: Order | null;
  try {
    const cart = await readCart(cartId);
    if (!cart) return { ok: false, code: 'EMPTY_CART' };
    const { body } = await apiRoot.orders().post({ body: { cart: { typeId: 'cart', id: cart.id }, version: cart.version } }).execute();
    order = body;
  } catch (error) {
    // A lost answer is not a failed order: if the cart did become an order, that is the result.
    order = await existingOrder(cartId).catch(() => null);
    if (!order) {
      log.error('checkout', 'order creation failed', error instanceof Error ? error : { name: typeof error });
      return { ok: false, code: 'PLACEMENT_FAILED' };
    }
  }
  const done = await finalizeOrder(order.id, { provider, now });
  if (done.ok) return { ok: true, orderId: done.orderId, orderNumber: done.orderNumber };
  return { ok: false, code: done.code === 'IN_PROGRESS' || done.code === 'DISPENSE_REFUSED' || done.code === 'FUNDING_CHANGED' ? done.code : 'PLACEMENT_FAILED' };
}

// ---------------------------------------------------------------- 2. finalize

export interface FinalizeOptions {
  /** For cancelling the card payment when the order is refused; resolved lazily when absent. */
  provider?: PaymentProvider | null;
  now?: Date;
}

/** True while an order still lacks what `finalizeOrder` adds (its `MLV-` number or its state): the signal to finalize lazily. */
export const needsFinalize = (order: Pick<Order, 'orderNumber' | 'state'>): boolean => !order.orderNumber || !order.state;

async function resolveProvider(): Promise<PaymentProvider | null> {
  try {
    const { getPaymentProvider } = await import('@/lib/checkout/provider');
    return await getPaymentProvider();
  } catch (error) {
    if (error instanceof PaymentUnavailableError) return null;
    throw error;
  }
}

type Acquired = { kind: 'go' } | { kind: 'answer'; outcome: FinalizeOutcome };

async function acquire(orderId: string, now: Date): Promise<Acquired> {
  const key = finalizeKey(orderId);
  const fresh: FinalizeRecord = { state: 'pending', at: now.toISOString() };
  if (await createOnly(CONTAINERS.orderAttempt, key, fresh)) return { kind: 'go' };
  const existing = await getObject<FinalizeRecord>(CONTAINERS.orderAttempt, key);
  if (!existing) return acquire(orderId, now);
  const v = existing.value;
  if (v.state === 'done') return { kind: 'answer', outcome: { ok: true, replay: true, orderId, orderNumber: v.orderNumber ?? '' } };
  if (v.state === 'refused') return { kind: 'answer', outcome: { ok: false, code: v.code ?? 'DISPENSE_REFUSED' } };
  if (now.getTime() - new Date(v.at).getTime() < STALE_PENDING_MS) return { kind: 'answer', outcome: { ok: false, code: 'IN_PROGRESS' } };
  try {
    await putObject<FinalizeRecord>(CONTAINERS.orderAttempt, key, fresh, existing.version);
    return { kind: 'go' };
  } catch (error) {
    if (statusOf(error) === 409) return { kind: 'answer', outcome: { ok: false, code: 'IN_PROGRESS' } };
    throw error;
  }
}

async function cancelRefusedOrder(orderId: string): Promise<void> {
  try {
    const { body } = await apiRoot.orders().withId({ ID: orderId }).get().execute();
    await apiRoot
      .orders()
      .withId({ ID: orderId })
      .post({ body: { version: body.version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: 'mlv-cancelled' }, force: true }] } })
      .execute();
  } catch (error) {
    log.error('checkout', 'could not cancel the refused order', error instanceof Error ? error : { name: typeof error });
  }
}

/** Sets the `MLV-` number only when the order has none, and the received state only when it has no storefront state. Safe to repeat. */
async function numberAndState(orderId: string): Promise<string> {
  let number = '';
  await withCartRetry(async () => {
    const { body: current } = await apiRoot.orders().withId({ ID: orderId }).get().execute();
    const all: OrderUpdateAction[] = [];
    if (current.orderNumber) number = current.orderNumber;
    else {
      number = await nextOrderNumber();
      all.push({ action: 'setOrderNumber', orderNumber: number });
    }
    if (!current.state) all.push({ action: 'transitionState', state: { typeId: 'state', key: ORDER_STATE_RECEIVED }, force: true });
    if (all.length === 0) return;
    await apiRoot.orders().withId({ ID: orderId }).post({ body: { version: current.version, actions: all } }).execute();
  });
  return number;
}

/**
 * The domain logic of a placed order, exactly once per order id, however the order came to exist (Checkout, or the
 * storefront for a fully covered cart). Idempotent: a record per order (`fin-<orderId>`) answers a repeat with the same
 * order, a concurrent run gets `IN_PROGRESS`, and each step is itself idempotent, so a crashed run is simply finished
 * by the next caller. Order of work: consume the prescription (a refusal cancels the order and gives the card payment
 * back through Checkout) -> draw the allowance / record the restricted instrument -> the `MLV-` number and state, last,
 * because a missing number or state is what tells a later reader that the order is not finalized yet.
 */
export async function finalizeOrder(orderId: string, options: FinalizeOptions = {}): Promise<FinalizeOutcome> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.finalizeFixtureOrder(orderId);
  if (!ORDER_ID.test(orderId)) return { ok: false, code: 'NOT_FOUND' };
  const now = options.now ?? new Date();
  const acquired = await acquire(orderId, now);
  if (acquired.kind === 'answer') return acquired.outcome;
  const key = finalizeKey(orderId);
  const record = (value: FinalizeRecord) => putObject<FinalizeRecord>(CONTAINERS.orderAttempt, key, value);

  try {
    const order = await readOrder(orderId);
    if (!order) {
      await deleteObject(CONTAINERS.orderAttempt, key);
      return { ok: false, code: 'NOT_FOUND' };
    }
    if (order.state?.obj?.key === 'mlv-cancelled') {
      await record({ state: 'done', at: now.toISOString(), orderNumber: order.orderNumber ?? '' });
      return { ok: true, replay: true, orderId, orderNumber: order.orderNumber ?? '' };
    }
    const provider = options.provider === undefined ? await resolveProvider() : options.provider;

    // 1. the prescription, once for this order id (the ledger is idempotent on it).
    try {
      const lines = await consumeLinesOf(order);
      if (lines && lines.length > 0) await consumeAuthorization(order.id, lines, now);
    } catch (error) {
      if (!(error instanceof DispenseRefusedError)) throw error;
      // The prescription changed between the gate and the order: the order exists, so it is cancelled and the card is given back.
      await cancelRefusedOrder(order.id);
      await returnCardPayments(paymentsOf(order), provider);
      await record({ state: 'refused', at: now.toISOString(), code: 'DISPENSE_REFUSED' });
      return { ok: false, code: 'DISPENSE_REFUSED' };
    }

    // 2. allowance and restricted instrument (idempotent on the order id).
    const plan = await planFromOrder(order);
    if (plan.allowance > 0 || plan.restricted > 0) {
      const patient = order.customerId ? await getPatient(order.customerId) : null;
      if (!patient) throw new Error('no patient for a funded order');
      const settled = await settleTender(order, plan, { patientRef: patient.patientRef, now });
      if (!settled.ok) {
        // The balance fell between the gate and the draw (another order took it): nothing may be left half done.
        await cancelRefusedOrder(order.id);
        await restoreAuthorization(order.id).catch(() => undefined);
        await restoreAllowance(order.id).catch(() => undefined);
        await returnCardPayments(paymentsOf(order), provider);
        await record({ state: 'refused', at: now.toISOString(), code: 'FUNDING_CHANGED' });
        return { ok: false, code: 'FUNDING_CHANGED' };
      }
    }

    // 3. the number and the state, only if unset.
    const orderNumber = await numberAndState(order.id);
    await record({ state: 'done', at: now.toISOString(), orderNumber });
    return { ok: true, replay: false, orderId, orderNumber };
  } catch (error) {
    // Unexpected: free the lock so the next caller can finish (every step above is idempotent).
    log.error('checkout', 'finalize interrupted', error instanceof Error ? error : { name: typeof error });
    await deleteObject(CONTAINERS.orderAttempt, key).catch(() => undefined);
    return { ok: false, code: 'PLACEMENT_FAILED' };
  }
}
