import 'server-only';
import type { Order } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { updateWithRetry } from '@/lib/ct/retry';
import { AppError } from '@/lib/errors';
import { returnableUnits } from '@/lib/mappers/account-order';
import type { OrderFilter, OrderStateKey } from '@/lib/types';

/** Expansions every account read uses: the state key and the store channel of collect lines. */
export const ORDER_EXPAND = ['state', 'lineItems[*].supplyChannel'];

const STATE_KEYS: Record<OrderStateKey, string> = {
  ordered: 'mcf-order-ordered',
  preparing: 'mcf-order-preparing',
  'ready-for-collection': 'mcf-order-ready-for-collection',
  collected: 'mcf-order-collected',
};

/** Ids of the four seeded `mcf-order-*` states (public data, cached with tag `project`). Never hard-coded. */
export const getOrderStateIds: () => Promise<Partial<Record<OrderStateKey, string>>> = cachedPublic(
  'project',
  ['order-state-ids'],
  async () => {
    const { body } = await apiRoot
      .states()
      // Constant keys, never user input.
      .get({ queryArgs: { where: `type="OrderState" and key in (${Object.values(STATE_KEYS).map((k) => `"${k}"`).join(',')})`, limit: 20 } })
      .execute();
    const out: Partial<Record<OrderStateKey, string>> = {};
    for (const s of body.results) {
      const entry = (Object.entries(STATE_KEYS) as [OrderStateKey, string][]).find(([, key]) => key === s.key);
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
  ids: Partial<Record<OrderStateKey, string>>,
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

const isNotFound = (e: unknown): boolean => (e as { statusCode?: unknown } | null)?.statusCode === 404;

/** The order with this number when it belongs to the customer; null for an unknown and a foreign order alike. */
export async function getOrderByNumber(customerId: string, orderNumber: string): Promise<Order | null> {
  try {
    const { body } = await apiRoot.orders().withOrderNumber({ orderNumber }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute();
    return body.customerId === customerId ? body : null;
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export async function getOrderById(customerId: string, id: string): Promise<Order | null> {
  try {
    const { body } = await apiRoot.orders().withId({ ID: id }).get({ queryArgs: { expand: ORDER_EXPAND } }).execute();
    return body.customerId === customerId ? body : null;
  } catch (e) {
    if (isNotFound(e)) return null;
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
