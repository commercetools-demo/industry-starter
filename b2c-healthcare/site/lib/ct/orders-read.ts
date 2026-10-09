import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';
import type { Order } from '@commercetools/platform-sdk';
import { finalizeOrder, needsFinalize } from '@/lib/ct/orders';
import { log } from '@/lib/log';
import { mapOrder } from '@/lib/mappers/order';
import type { OrderView } from '@/lib/order-types';

const UNSAFE = /[^\w-]/g;
export const ORDER_EXPAND = ['state', 'shippingInfo.shippingMethod', 'paymentInfo.payments[*]'];
export const ORDER_LIST_LIMIT = 50;

/**
 * One of the customer's orders. The lookup is a query on id AND customerId, so another customer's order and an id
 * that does not exist are the same answer (null): nothing tells them apart.
 */
export async function getOrderForCustomer(id: string, customerId: string, locale: string): Promise<OrderView | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) {
    if (fixtures.fixtureOrder(id, customerId)) await fixtures.finalizeFixtureOrder(id);
    return fixtures.fixtureOrder(id, customerId);
  }
  const order = await getRawOrderForCustomer(id, customerId);
  return order ? mapOrder(order, locale) : null;
}

/** The customer's orders, newest first (query by `customerId`; never anyone else's). */
export async function listOrdersForCustomer(customerId: string, locale: string): Promise<OrderView[]> {
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.fixtureOrderList(customerId);
  const { body } = await apiRoot
    .orders()
    .get({ queryArgs: { where: `customerId="${customerId.replace(UNSAFE, '')}"`, sort: 'createdAt desc', limit: ORDER_LIST_LIMIT, expand: ORDER_EXPAND } })
    .execute();
  // An order Checkout just created and nobody finalized yet (the buyer closed the tab) is finished here, like on the order page.
  const open = body.results.filter(needsFinalize);
  if (open.length > 0) {
    await Promise.all(open.map((o) => finalizeOrder(o.id).catch((error) => log.error('orders', 'lazy finalize failed', error instanceof Error ? error : { name: typeof error }))));
    const again = await apiRoot
      .orders()
      .get({ queryArgs: { where: `customerId="${customerId.replace(UNSAFE, '')}"`, sort: 'createdAt desc', limit: ORDER_LIST_LIMIT, expand: ORDER_EXPAND } })
      .execute();
    return again.body.results.map((o) => mapOrder(o, locale));
  }
  return body.results.map((o) => mapOrder(o, locale));
}

/** Whether the order exists and is the customer's (the completion callback's guard; no finalize, no mapping). */
export async function orderBelongsTo(id: string, customerId: string): Promise<boolean> {
  if (!/^[\w-]{1,64}$/.test(id)) return false;
  const fixtures = await loadCheckoutFixtures();
  if (fixtures) return fixtures.fixtureOrderOwner(id) === customerId;
  const { body } = await apiRoot.orders().get({ queryArgs: { where: `id="${id}" and customerId="${customerId.replace(UNSAFE, '')}"`, limit: 1 } }).execute();
  return body.results.length > 0;
}

/**
 * The platform order itself (line custom fields included), for server work such as reorder and cancel. Same rule as
 * `getOrderForCustomer`: another customer's order and an unknown id are both null. Not available in fixtures mode.
 */
export async function getRawOrderForCustomer(id: string, customerId: string): Promise<Order | null> {
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  if (await loadCheckoutFixtures()) return null;
  const query = () =>
    apiRoot
      .orders()
      .get({ queryArgs: { where: `id="${id}" and customerId="${customerId.replace(UNSAFE, '')}"`, limit: 1, expand: ORDER_EXPAND } })
      .execute();
  let order = (await query()).body.results[0] ?? null;
  // Checkout creates the order; our domain work (number, state, prescription, allowance) runs once per order. The
  // browser callback normally did it already; if the buyer closed the tab first, reading the order finishes it here.
  if (order && needsFinalize(order)) {
    const done = await finalizeOrder(order.id).catch((error) => {
      log.error('orders', 'lazy finalize failed', error instanceof Error ? error : { name: typeof error });
      return null;
    });
    if (done?.ok || done?.code === 'DISPENSE_REFUSED') order = (await query()).body.results[0] ?? order;
  }
  return order;
}
