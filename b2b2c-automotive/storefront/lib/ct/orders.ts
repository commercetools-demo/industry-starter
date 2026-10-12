// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Orders as workstream O needs them. The order of a shopper is created by commercetools Checkout (O D5), never by this module; the only
// writes here are the order number fallback, the pickup branch reconciliation and the dev-only helper (O-08, no Payment ever).
import 'server-only';
import type { Cart as CtCart, Order } from '@commercetools/platform-sdk';
import { ORDER_NUMBER_FORMAT, deriveOrderNumber } from '@/lib/checkout/order-number';
import { postActions } from '@/lib/ct/cart';
import { apiRoot } from '@/lib/ct/client';
import { CHECKOUT_TYPE_KEY, PICKUP_BRANCH_FIELD, SHIP_PICKUP_KEY } from '@/lib/ct/delivery';
import { inStore } from '@/lib/ct/in-store';

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null ? (error as { statusCode?: number }).statusCode : undefined;
const errorCodes = (error: unknown): string[] =>
  ((error as { body?: { errors?: { code?: string }[] } })?.body?.errors ?? []).map((e) => e.code ?? '');

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPAND = ['shippingInfo.shippingMethod'];

/** The order, or `null` for a malformed id or a 404. */
export async function getOrderById(orderId: string): Promise<Order | null> {
  if (!UUID.test(orderId)) return null;
  try {
    const { body } = await apiRoot.orders().withId({ ID: orderId }).get({ queryArgs: { expand: EXPAND } }).execute();
    return body;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/** The order with this number, or `null` (malformed number, none found). */
export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  if (!ORDER_NUMBER_FORMAT.test(orderNumber)) return null;
  const { body } = await apiRoot
    .orders()
    .get({ queryArgs: { where: `orderNumber="${orderNumber}"`, limit: 1, expand: EXPAND } })
    .execute();
  return body.results[0] ?? null;
}

/**
 * Fallback only: Checkout sets the number itself from `futureOrderNumber` (see `createCheckoutSession`). An order that has none (the
 * Application ignored the field, or an order from before this change) gets `MA-` plus 8 characters derived from its id with
 * `setOrderNumber`. Version conflicts reload; a duplicate number retries with the next salt. Reading again is a no-op.
 */
export async function ensureOrderNumber(order: Order): Promise<string> {
  if (order.orderNumber) return order.orderNumber;
  let current = order;
  for (let salt = 0; salt < 3; ) {
    const orderNumber = deriveOrderNumber(order.id, salt);
    try {
      const { body } = await apiRoot
        .orders()
        .withId({ ID: current.id })
        .post({ body: { version: current.version, actions: [{ action: 'setOrderNumber', orderNumber }] } })
        .execute();
      return body.orderNumber ?? orderNumber;
    } catch (error) {
      const status = statusOf(error);
      if (status === 400 && errorCodes(error).includes('DuplicateField')) {
        salt += 1;
        continue;
      }
      if (status === 409) {
        const { body } = await apiRoot.orders().withId({ ID: current.id }).get().execute();
        if (body.orderNumber) return body.orderNumber;
        current = body;
        continue;
      }
      throw error;
    }
  }
  throw new Error('No unique order number found');
}

/**
 * The hosted Checkout lets the shopper change the preset delivery method. The pickup branch is only meaningful for pickup orders:
 * pickup keeps (or receives) `pickupBranchKey`, any other method clears it. No write when nothing changes.
 */
export async function reconcilePickupBranch(order: Order, branchKey: string | undefined): Promise<void> {
  const pickup = order.shippingInfo?.shippingMethod?.obj?.key === SHIP_PICKUP_KEY;
  const current = order.custom?.fields?.[PICKUP_BRANCH_FIELD] as string | undefined;
  const wanted = pickup ? (current ?? branchKey) : undefined;
  if (wanted === current) return;
  const hasType = Boolean(order.custom?.type);
  const action = hasType
    ? ({ action: 'setCustomField', name: PICKUP_BRANCH_FIELD, ...(wanted ? { value: wanted } : {}) } as const)
    : wanted
      ? ({ action: 'setCustomType', type: { typeId: 'type', key: CHECKOUT_TYPE_KEY }, fields: { [PICKUP_BRANCH_FIELD]: wanted } } as const)
      : null;
  if (!action) return;
  try {
    await apiRoot.orders().withId({ ID: order.id }).post({ body: { version: order.version, actions: [action] } }).execute();
  } catch (error) {
    // Best effort: a concurrent write (409) is not worth failing the shopper's confirmation for.
    if (statusOf(error) !== 409) throw error;
  }
}

export interface DevOrderInput {
  storeKey: string;
  cartId: string;
  customerEmail: string;
}

/**
 * DEV ONLY (O-08). Creates an order from the cart without any payment: sets the email and a country-only shipping address when
 * missing, orders the cart with the number from the cart id (`orderState Open`, `paymentState Pending`), and creates a Recurring Order for a
 * cart with subscription lines (best effort). It never creates a Payment. The caller has already refused production.
 */
export async function createDevOrderFromCart(input: DevOrderInput): Promise<Order> {
  const { body: cart } = await inStore(input.storeKey).carts().withId({ ID: input.cartId }).get().execute();
  const country = cart.country ?? 'DE';
  const actions: Parameters<typeof postActions>[2] = [];
  if (!cart.customerEmail) actions.push({ action: 'setCustomerEmail', email: input.customerEmail });
  if (!cart.shippingAddress?.country) actions.push({ action: 'setShippingAddress', address: { country } });
  const prepared: CtCart = actions.length ? await postActions(input.storeKey, input.cartId, actions) : cart;
  const { body: order } = await inStore(input.storeKey)
    .orders()
    .post({
      body: {
        cart: { typeId: 'cart', id: prepared.id },
        version: prepared.version,
        orderNumber: deriveOrderNumber(prepared.id),
        orderState: 'Open',
        paymentState: 'Pending',
      },
    })
    .execute();
  if ((prepared.lineItems ?? []).some((line) => line.recurrenceInfo)) await createDevRecurringOrder(input.storeKey, prepared.id, order);
  return order;
}

async function createDevRecurringOrder(storeKey: string, cartId: string, order: Order): Promise<void> {
  try {
    const { body: ordered } = await inStore(storeKey).carts().withId({ ID: cartId }).get().execute();
    await apiRoot
      .recurringOrders()
      .post({ body: { key: `ro-${order.orderNumber ?? order.id}`, cart: { typeId: 'cart', id: cartId }, cartVersion: ordered.version } })
      .execute();
  } catch (error) {
    // The order stands (the Recurring Orders guide: never roll an order back for this); only the status is logged.
    console.error(`[checkout] dev recurring order failed${statusOf(error) ? ` with status ${statusOf(error)}` : ''}`);
  }
}
