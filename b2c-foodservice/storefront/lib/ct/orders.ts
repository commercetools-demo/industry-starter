import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { baseOrderNumber, numbersOfPurchase } from '@/lib/checkout/order-number';
import { apiRoot } from '@/lib/ct/client';
import { updateWithRetry } from '@/lib/ct/retry';
import { mapOrder } from '@/lib/mappers/order';
import type { OrderView } from '@/lib/types';

/** Order reads (workstream K, 3.5). L extends this file with the account order list. */
const EXPAND = [
  'state',
  'lineItems[*].supplyChannel',
  'lineItems[*].recurrenceInfo.recurrencePolicy',
  'shippingInfo.shippingMethod',
];

/** Numbers this app creates (`MC-` plus 10 base32 characters, optional part suffix). Anything else is never put in a query. */
const ORDER_NUMBER = /^MC-[0-9A-Z]{10}(-[A-H])?$/;

export const ORDERED_STATE_KEY = 'mcf-order-ordered';

const notFound = (e: unknown) => (e as { statusCode?: number })?.statusCode === 404;

export async function getOrderById(id: string): Promise<Order | null> {
  try {
    return (await apiRoot.orders().withId({ ID: id }).get({ queryArgs: { expand: EXPAND } }).execute()).body;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  try {
    return (await apiRoot.orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: EXPAND } }).execute()).body;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

/**
 * The hosted Checkout creates the order without a `state`. Sets `mcf-order-ordered` when there is none. Idempotent: a conflict
 * re-reads and checks again, and an order that already has a state is returned as it is. A failure is logged (order number
 * only) and the order is returned unchanged: the confirmation then shows no tracker and the next read tries again (Q-K-05).
 */
export async function ensureOrderState(order: Order): Promise<Order> {
  if (order.state) return order;
  try {
    const { body } = await updateWithRetry(
      async () => (await apiRoot.orders().withId({ ID: order.id }).get({ queryArgs: { expand: EXPAND } }).execute()).body,
      async (current) => {
        if (current.state) return { body: current };
        return apiRoot
          .orders()
          .withId({ ID: current.id })
          .post({
            body: { version: current.version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: ORDERED_STATE_KEY } }] },
            queryArgs: { expand: EXPAND },
          })
          .execute();
      },
    );
    return body;
  } catch {
    console.warn(JSON.stringify({ event: 'order_state_failed', orderNumber: order.orderNumber ?? order.id }));
    return order;
  }
}

/** The other orders of the same purchase (complete-per-group), by the shared base number. */
export async function getLinkedOrders(orderNumber: string): Promise<{ id: string; orderNumber: string }[]> {
  if (!ORDER_NUMBER.test(orderNumber)) return [];
  const base = baseOrderNumber(orderNumber);
  const numbers = numbersOfPurchase(base).filter((n) => n !== orderNumber);
  const where = `orderNumber in (${numbers.map((n) => `"${n}"`).join(', ')})`;
  const { body } = await apiRoot.orders().get({ queryArgs: { where, limit: 8, sort: 'orderNumber asc' } }).execute();
  return body.results.flatMap((o) => (o.orderNumber ? [{ id: o.id, orderNumber: o.orderNumber }] : []));
}

/** The view of an order for the confirmation and the account (state is made sure of first). Null when unknown. */
export async function getOrderView(id: string, locale: string, now: Date = new Date()): Promise<OrderView | null> {
  const found = await getOrderById(id);
  if (!found) return null;
  const order = await ensureOrderState(found);
  const linked = order.orderNumber ? await getLinkedOrders(order.orderNumber).catch(() => []) : [];
  return mapOrder(order, { locale, now, linked });
}
