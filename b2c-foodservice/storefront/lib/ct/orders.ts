import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { baseOrderNumber, numbersOfPurchase } from '@/lib/checkout/order-number';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { mapOrder, returnableUnits } from '@/lib/mappers/order';
import type { OrderFilter, OrderState, OrderView } from '@/lib/types';

/** Order reads and writes: the confirmation (K) and the account list, detail and returns (L). One expansion for every read. */
export const ORDER_EXPAND = [
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
    return (await apiRoot.orders().withId({ ID: id }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute()).body;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  try {
    return (await apiRoot.orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute()).body;
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
      async () => (await apiRoot.orders().withId({ ID: order.id }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute()).body,
      async (current) => {
        if (current.state) return { body: current };
        return apiRoot
          .orders()
          .withId({ ID: current.id })
          .post({
            body: { version: current.version, actions: [{ action: 'transitionState', state: { typeId: 'state', key: ORDERED_STATE_KEY } }] },
            queryArgs: { expand: ORDER_EXPAND },
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

// Account reads (workstream L). The customer id predicate and the ownership check are mandatory: the orders endpoint is project-wide.

const STATE_KEYS: Record<OrderState, string> = {
  ordered: 'mcf-order-ordered',
  preparing: 'mcf-order-preparing',
  'ready-for-collection': 'mcf-order-ready-for-collection',
  collected: 'mcf-order-collected',
};

/** Ids of the four seeded `mcf-order-*` states (public data, cached with tag `project`). Never hard-coded. */
export const getOrderStateIds: () => Promise<Partial<Record<OrderState, string>>> = cachedPublic(
  'project',
  ['order-state-ids'],
  async () => {
    const { body } = await apiRoot
      .states()
      // Constant keys, never user input.
      .get({ queryArgs: { where: `type="OrderState" and key in (${Object.values(STATE_KEYS).map((k) => `"${k}"`).join(',')})`, limit: 20 } })
      .execute();
    const out: Partial<Record<OrderState, string>> = {};
    for (const s of body.results) {
      const entry = (Object.entries(STATE_KEYS) as [OrderState, string][]).find(([, key]) => key === s.key);
      if (entry) out[entry[0]] = s.id;
    }
    return out;
  },
);

export interface OrderQuery { where: string; vars: Record<string, string> }

/**
 * The query predicate of a customer's orders. The `customerId` predicate is mandatory: the orders endpoint is project-wide.
 * `ready` = in the ready-for-collection state; `completed` = collected or delivered; `in-progress` = neither, and not cancelled.
 */
export function buildOrderQuery(
  customerId: string,
  filter: OrderFilter,
  ids: Partial<Record<OrderState, string>>,
): OrderQuery {
  const vars: Record<string, string> = { id: customerId };
  const parts = ['customerId=:id'];
  if (filter === 'ready') {
    vars.ready = ids['ready-for-collection'] ?? 'none';
    parts.push('state(id=:ready)');
  } else if (filter === 'completed') {
    vars.done = ids.collected ?? 'none';
    parts.push('(state(id=:done) or shipmentState="Delivered")');
  } else if (filter === 'in-progress') {
    vars.done = ids.collected ?? 'none';
    parts.push('not(state(id=:done))', 'not(shipmentState="Delivered")', 'orderState!="Cancelled"');
  }
  return { where: parts.join(' and '), vars };
}

const toVars = (vars: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(vars).map(([k, v]) => [`var.${k}`, v]));

export async function listOrders(
  customerId: string,
  { filter, limit, offset }: { filter: OrderFilter; limit: number; offset: number },
): Promise<{ results: Order[]; total: number }> {
  const q = buildOrderQuery(customerId, filter, await getOrderStateIds());
  const { body } = await apiRoot
    .orders()
    .get({
      queryArgs: { where: q.where, ...toVars(q.vars), sort: 'createdAt desc', limit, offset, withTotal: true, expand: ORDER_EXPAND },
    })
    .execute();
  return { results: body.results, total: body.total ?? body.results.length };
}

/** Number of orders matching a filter (one row read, `withTotal`). */
export async function countOrders(customerId: string, filter: OrderFilter): Promise<number> {
  const q = buildOrderQuery(customerId, filter, await getOrderStateIds());
  const { body } = await apiRoot
    .orders()
    .get({ queryArgs: { where: q.where, ...toVars(q.vars), limit: 1, withTotal: true } })
    .execute();
  return body.total ?? body.results.length;
}

/** The order with this number when it belongs to the customer; null for an unknown and a foreign order alike. */
export async function getCustomerOrderByNumber(customerId: string, orderNumber: string): Promise<Order | null> {
  try {
    const { body } = await apiRoot.orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute();
    return body.customerId === customerId ? body : null;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

export async function getCustomerOrderById(customerId: string, id: string): Promise<Order | null> {
  try {
    const { body } = await apiRoot.orders().withId({ ID: id }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute();
    return body.customerId === customerId ? body : null;
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

export interface ReturnLineInput { lineId: string; quantity: number; reason?: string }

/** `addReturnInfo` for the given lines, on the latest version (one retry on a conflict). The caller checked ownership and limits. */
export async function addReturn(orderId: string, items: ReturnLineInput[], now = new Date()): Promise<Order> {
  return updateWithRetry(
    async () => (await apiRoot.orders().withId({ ID: orderId }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute()).body,
    async (current) => {
      // The latest version decides: a second return started meanwhile may have used the units up.
      const left = returnableUnits(current);
      if (items.some((i) => i.quantity > (left[i.lineId] ?? 0))) throw new AppError('conflict', 409);
      return (
        await apiRoot
          .orders()
          .withId({ ID: orderId })
          .post({
            queryArgs: { expand: ORDER_EXPAND },
            body: {
              version: current.version,
              actions: [
                {
                  action: 'addReturnInfo',
                  returnDate: now.toISOString(),
                  items: items.map((i) => ({
                    quantity: i.quantity,
                    lineItemId: i.lineId,
                    ...(i.reason ? { comment: i.reason } : {}),
                    shipmentState: 'Advised' as const,
                  })),
                },
              ],
            },
          })
          .execute()
      ).body;
    },
  );
}
