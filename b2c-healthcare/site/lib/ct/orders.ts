import 'server-only';
import type { Cart as CtCart, CartUpdateAction, Order } from '@commercetools/platform-sdk';
import { withCartRetry } from '@/lib/api-retry';
import { ORDER_STATE_RECEIVED } from '@/lib/checkout/config';
import type { AuthorizationState, PaymentProvider } from '@/lib/checkout/payment-provider';
import { apiRoot } from '@/lib/ct/client';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';
import type { CheckoutContext } from '@/lib/ct/checkout';
import { refreshFunding } from '@/lib/ct/cart-funding';
import { CONTAINERS, createOnly, deleteObject, getObject, putObject, statusOf } from '@/lib/ct/custom-objects';
import { consumeAuthorization, DispenseRefusedError, type ConsumeLine } from '@/lib/ct/dispense-ledger';
import { nextOrderNumber } from '@/lib/ct/order-number';
import { findOwnPrescription, RxNotFoundError, validateRxSelection } from '@/lib/ct/prescriptions';
import { getOptionsForCart } from '@/lib/ct/shipping-options';
import { buildLineRecord, toLineCustomFields } from '@/lib/dispense/line-record';
import { log } from '@/lib/log';
import { mapCartAddress, mapCheckoutCart } from '@/lib/mappers/checkout';
import { rxFieldsOf } from '@/lib/mappers/cart';
import type { PlaceOrderFailure, PlacedOrder } from '@/lib/types';

/**
 * Placing the order (workstream Q). The one irreversible step, done once, from the cart the server holds:
 *
 *  1. a lock per attempt (idempotency key = cart id + version, created create-only): a double submit is refused
 *     while the first runs and answered with the same order afterwards;
 *  2. the cart is read again and everything is re-checked: lines against the prescription rules (N), the delivery
 *     method against the platform (and the same-day cut-off), the cart total against the amount the buyer saw and
 *     against the amount the payment authorized (a mismatch refuses and releases the stale authorization);
 *  3. the prescription record is written to the cart lines (copied onto the order lines), an order number is
 *     taken from the counter, the order is created from the cart in state `mlv-received`;
 *  4. the prescription is consumed (`consumeAuthorization`, idempotent on the order id).
 *
 * A failure before the order exists keeps the cart, releases the authorization and says so. Totals are the cart's;
 * nothing here adds a price. Health-data rule: no RX number, medication or address reaches a log line.
 */

export interface PlaceOrderInput {
  ctx: CheckoutContext;
  /** The cart the session holds. */
  cartId: string;
  /** The total the buyer was shown (cents + currency): the order is created only if the cart still says this. */
  expectedTotal: { centAmount: number; currencyCode: string };
  /** `cart id + version` as `[A-Za-z0-9_-]`; the same key always means the same attempt. */
  idempotencyKey: string;
}

export type PlaceOrderOutcome =
  | ({ ok: true; replay: boolean } & PlacedOrder)
  | { ok: false; code: PlaceOrderFailure; lineIds?: string[] };

interface AttemptValue {
  state: 'pending' | 'created' | 'done' | 'refused';
  at: string;
  orderId?: string;
  orderNumber?: string;
  code?: PlaceOrderFailure;
}

/** A pending attempt older than this is treated as crashed and may be taken over. */
const STALE_PENDING_MS = 2 * 60 * 1000;
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{3,200}$/;

const fail = (code: PlaceOrderFailure, lineIds?: string[]): PlaceOrderOutcome => ({ ok: false, code, ...(lineIds ? { lineIds } : {}) });
const sameTotal = (a: { centAmount: number; currencyCode: string }, b: { centAmount: number; currencyCode: string }) => a.centAmount === b.centAmount && a.currencyCode === b.currencyCode;

async function findOrderForCart(cartId: string): Promise<Order | null> {
  const { body } = await apiRoot.orders().get({ queryArgs: { where: `cart(id="${cartId}")`, limit: 1, expand: ['state'] } }).execute();
  return body.results[0] ?? null;
}

type Acquired = { kind: 'go' } | { kind: 'resume'; orderId: string; orderNumber: string } | { kind: 'answer'; outcome: PlaceOrderOutcome };

/** Takes the attempt lock. */
async function acquire(key: string, now: Date): Promise<Acquired> {
  const fresh: AttemptValue = { state: 'pending', at: now.toISOString() };
  if (await createOnly(CONTAINERS.orderAttempt, key, fresh)) return { kind: 'go' };
  const existing = await getObject<AttemptValue>(CONTAINERS.orderAttempt, key);
  if (!existing) return acquire(key, now);
  const v = existing.value;
  if (v.state === 'done' && v.orderId && v.orderNumber) return { kind: 'answer', outcome: { ok: true, replay: true, orderId: v.orderId, orderNumber: v.orderNumber } };
  if (v.state === 'refused') return { kind: 'answer', outcome: fail(v.code ?? 'PLACEMENT_FAILED') };
  if (v.state === 'created' && v.orderId && v.orderNumber) return { kind: 'resume', orderId: v.orderId, orderNumber: v.orderNumber };
  if (now.getTime() - new Date(v.at).getTime() < STALE_PENDING_MS) return { kind: 'answer', outcome: fail('IN_PROGRESS') };
  try {
    await putObject<AttemptValue>(CONTAINERS.orderAttempt, key, fresh, existing.version);
    return { kind: 'go' };
  } catch (error) {
    if (statusOf(error) === 409) return { kind: 'answer', outcome: fail('IN_PROGRESS') };
    throw error;
  }
}

const setAttempt = (key: string, value: AttemptValue) => putObject<AttemptValue>(CONTAINERS.orderAttempt, key, value);

async function releaseQuietly(provider: PaymentProvider, auth: AuthorizationState): Promise<void> {
  if (auth.status !== 'authorized') return;
  try {
    await provider.release(auth.paymentId);
  } catch (error) {
    // The order is not placed either way; an authorization that cannot be voided expires at the PSP.
    log.error('checkout', 'could not release authorization', error instanceof Error ? error : { name: typeof error });
  }
}

interface Prepared {
  cart: CtCart;
  consume: ConsumeLine[];
  actions: CartUpdateAction[];
}

/** Re-runs the prescription rules for every line and builds what the order needs (the line records, the ledger input). */
async function prepareLines(ctx: CheckoutContext, cart: CtCart): Promise<Prepared | { failed: PlaceOrderOutcome }> {
  const byRx = new Map<string, { id: string; lineRef: string }[]>();
  const unavailable: string[] = [];
  for (const item of cart.lineItems) {
    const f = rxFieldsOf(item);
    if (!f) unavailable.push(item.id);
    else byRx.set(f.rxNumber, [...(byRx.get(f.rxNumber) ?? []), { id: item.id, lineRef: f.rxLineRef }]);
  }
  const consume: ConsumeLine[] = [];
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
        consume.push({
          patientRef: ctx.patient.patientRef,
          rxNumber,
          lineRef: accepted.lineRef,
          sku: accepted.sku,
          qty: accepted.qty,
          packs: accepted.packs,
          perOrderMax: accepted.perOrderMax,
          periodCeiling: accepted.periodCeiling,
        });
        // The authorization as it stands NOW, before the consumption below: it is copied onto the order line (N-09).
        const fields = toLineCustomFields(buildLineRecord(rx, prescribed, accepted.qty));
        for (const name of ['dispensedQty', 'authorizationParams', 'suppliedLots'] as const) {
          actions.push({ action: 'setLineItemCustomField', lineItemId: lineId, name, value: fields[name] });
        }
      }
    } catch (error) {
      if (!(error instanceof RxNotFoundError)) throw error;
      for (const g of group) unavailable.push(g.id);
    }
  }
  if (unavailable.length > 0) return { failed: fail('LINES_UNAVAILABLE', [...new Set(unavailable)]) };
  return { cart, consume, actions };
}

/** The order the cart already became (a retry after success, or after a lost response), if it is not cancelled. */
async function existingOrder(cartId: string): Promise<PlacedOrder | null> {
  const order = await findOrderForCart(cartId);
  if (!order?.orderNumber || order.state?.obj?.key === 'mlv-cancelled') return null;
  return { orderId: order.id, orderNumber: order.orderNumber };
}

/**
 * Places the order for the customer's cart. See the module comment for the sequence. Returns an outcome; only
 * unexpected errors throw (the Route Handler sanitizes them).
 */
export async function placeOrder(input: PlaceOrderInput, provider: PaymentProvider): Promise<PlaceOrderOutcome> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.placeOrder(input, provider);
  const { ctx, cartId, expectedTotal, idempotencyKey } = input;
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) return fail('PLACEMENT_FAILED');

  const acquired = await acquire(idempotencyKey, ctx.now);
  if (acquired.kind === 'answer') return acquired.outcome;

  const retryable = async (code: PlaceOrderFailure): Promise<PlaceOrderOutcome> => {
    await deleteObject(CONTAINERS.orderAttempt, idempotencyKey);
    return fail(code);
  };

  try {
    if (acquired.kind === 'resume') {
      // The order exists; only the prescription consumption (or the final write) was interrupted. Finish it.
      const order = await findOrderForCart(cartId);
      if (!order) return fail('PLACEMENT_FAILED');
      return finalize({ key: idempotencyKey, ctx, provider, order, orderNumber: acquired.orderNumber, consume: consumeInputFromOrder(ctx, order), auth: await provider.getAuthorization(cartId) });
    }

    let cart = await readCart(cartId);
    if (!cart || cart.customerId !== ctx.customerId) return retryable('EMPTY_CART');
    if (cart.cartState === 'Ordered') {
      const placed = await existingOrder(cart.id);
      if (placed) {
        await setAttempt(idempotencyKey, { state: 'done', at: ctx.now.toISOString(), ...placed });
        return { ok: true, replay: true, ...placed };
      }
      return retryable('EMPTY_CART');
    }
    if (cart.cartState !== 'Active' || cart.lineItems.length === 0) return retryable('EMPTY_CART');
    // Payer cost-share again, now (U-03): the split the buyer saw may be stale. Unresolved never defaults to the list
    // price; a changed split changes the total, which the comparison below refuses with the new figures on the cart.
    const funding = await refreshFunding(cart, ctx.patient);
    if (funding.unresolved) return retryable('COVER_UNRESOLVED');
    if (funding.changed) cart = (await readCart(cart.id)) ?? cart;
    if (!mapCartAddress(cart.shippingAddress)) return retryable('ADDRESS_MISSING');
    const methodKey = cart.shippingInfo?.shippingMethod?.obj?.key;
    if (!cart.shippingInfo || !methodKey) return retryable('NO_DELIVERY_METHOD');
    // The method must still be one the platform offers for this cart now (same-day closes at 14:00 New York).
    if (!(await getOptionsForCart(cart.id, ctx.now)).some((o) => o.key === methodKey)) return retryable('NO_DELIVERY_METHOD');

    // Totals: only from the cart.
    const cartTotal = mapCheckoutCart(cart).total;
    const auth = await provider.getAuthorization(cart.id);
    if (!sameTotal(cartTotal, expectedTotal)) {
      if (auth.status === 'authorized' && !sameTotal(cartTotal, auth)) await releaseQuietly(provider, auth);
      return retryable('TOTALS_MOVED');
    }
    if (auth.status === 'none') return retryable('PAYMENT_REQUIRED');
    if (auth.status === 'declined') return retryable('PAYMENT_DECLINED');
    if (!sameTotal(cartTotal, auth)) {
      await releaseQuietly(provider, auth);
      return retryable('TOTALS_MOVED');
    }

    // Prescription rules, once more, and the line records.
    const prepared = await prepareLines(ctx, cart);
    if ('failed' in prepared) {
      await deleteObject(CONTAINERS.orderAttempt, idempotencyKey);
      return prepared.failed;
    }

    let updated: CtCart;
    try {
      updated = await withCartRetry(async () => {
        const current = (await readCart(cart.id)) ?? cart;
        const { body } = await apiRoot.carts().withId({ ID: current.id }).post({ body: { version: current.version, actions: prepared.actions } }).execute();
        return body;
      });
    } catch (error) {
      await releaseQuietly(provider, auth);
      log.error('checkout', 'could not record the prescription on the cart', error instanceof Error ? error : { name: typeof error });
      return retryable('PLACEMENT_FAILED');
    }
    if (!sameTotal(mapCheckoutCart(updated).total, expectedTotal)) {
      await releaseQuietly(provider, auth);
      return retryable('TOTALS_MOVED');
    }

    // The order.
    let orderNumber: string;
    try {
      orderNumber = await nextOrderNumber();
    } catch (error) {
      await releaseQuietly(provider, auth);
      log.error('checkout', 'could not take an order number', error instanceof Error ? error : { name: typeof error });
      return retryable('PLACEMENT_FAILED');
    }
    let order: Order;
    try {
      const { body } = await apiRoot
        .orders()
        .post({ body: { cart: { typeId: 'cart', id: updated.id }, version: updated.version, orderNumber, state: { typeId: 'state', key: ORDER_STATE_RECEIVED } } })
        .execute();
      order = body;
    } catch (error) {
      // A lost answer is not a failed order: if the cart did become an order, that is the result.
      const placed = await existingOrder(updated.id).catch(() => null);
      if (placed) {
        await setAttempt(idempotencyKey, { state: 'done', at: ctx.now.toISOString(), ...placed });
        return { ok: true, replay: true, ...placed };
      }
      await releaseQuietly(provider, auth);
      log.error('checkout', 'order creation failed', error instanceof Error ? error : { name: typeof error });
      return retryable('PLACEMENT_FAILED');
    }
    await setAttempt(idempotencyKey, { state: 'created', at: ctx.now.toISOString(), orderId: order.id, orderNumber });
    return finalize({ key: idempotencyKey, ctx, provider, order, orderNumber, consume: prepared.consume, auth });
  } catch (error) {
    // Unexpected: free the lock unless the order already exists, so the buyer can try again.
    const current = await getObject<AttemptValue>(CONTAINERS.orderAttempt, idempotencyKey).catch(() => null);
    if (current?.value.state === 'pending') await deleteObject(CONTAINERS.orderAttempt, idempotencyKey).catch(() => undefined);
    throw error;
  }
}

async function readCart(cartId: string): Promise<CtCart | null> {
  try {
    const { body } = await apiRoot.carts().withId({ ID: cartId }).get({ queryArgs: { expand: ['shippingInfo.shippingMethod'] } }).execute();
    return body;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/** The ledger input for an order that already exists (a resumed attempt), from what the order lines recorded. */
function consumeInputFromOrder(ctx: CheckoutContext, order: Order): ConsumeLine[] {
  const lines: ConsumeLine[] = [];
  for (const item of order.lineItems) {
    const f = item.custom?.fields as Record<string, unknown> | undefined;
    if (!f || typeof f.rxNumber !== 'string' || typeof f.rxLineRef !== 'string') continue;
    // Limits were checked when the order was prepared; a resumed run only has to finish the consumption.
    lines.push({ patientRef: ctx.patient.patientRef, rxNumber: f.rxNumber, lineRef: f.rxLineRef, sku: item.variant.sku ?? '', qty: Number(f.dispensedQty ?? f.prescribedQty ?? 0), packs: item.quantity, perOrderMax: null, periodCeiling: null });
  }
  return lines;
}

interface Finalize {
  key: string;
  ctx: CheckoutContext;
  provider: PaymentProvider;
  order: Order;
  orderNumber: string;
  consume: ConsumeLine[];
  auth: AuthorizationState;
}

/** Consumes the prescription once for the order id and closes the attempt. A refusal cancels the order and releases the payment. */
async function finalize({ key, ctx, provider, order, orderNumber, consume, auth }: Finalize): Promise<PlaceOrderOutcome> {
  try {
    await consumeAuthorization(order.id, consume);
  } catch (error) {
    if (error instanceof DispenseRefusedError) {
      await cancelOrder(order.id);
      await releaseQuietly(provider, auth);
      await setAttempt(key, { state: 'refused', at: ctx.now.toISOString(), orderId: order.id, code: 'DISPENSE_REFUSED' });
      return fail('DISPENSE_REFUSED');
    }
    // The order exists and the consumption is idempotent on the order id: the same key resumes here.
    log.error('checkout', 'consumption interrupted', error instanceof Error ? error : { name: typeof error });
    return fail('IN_PROGRESS');
  }
  await setAttempt(key, { state: 'done', at: ctx.now.toISOString(), orderId: order.id, orderNumber });
  return { ok: true, replay: false, orderId: order.id, orderNumber };
}

async function cancelOrder(orderId: string): Promise<void> {
  try {
    const { body } = await apiRoot.orders().withId({ ID: orderId }).get().execute();
    await apiRoot
      .orders()
      .withId({ ID: orderId })
      .post({ body: { version: body.version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: 'mlv-cancelled' } }] } })
      .execute();
  } catch (error) {
    log.error('checkout', 'could not cancel the refused order', error instanceof Error ? error : { name: typeof error });
  }
}
