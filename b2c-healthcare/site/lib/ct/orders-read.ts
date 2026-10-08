import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { loadCheckoutFixtures } from '@/lib/ct/fixtures';
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
  if (fixtures) return fixtures.fixtureOrder(id, customerId);
  const { body } = await apiRoot
    .orders()
    .get({ queryArgs: { where: `id="${id}" and customerId="${customerId.replace(UNSAFE, '')}"`, limit: 1, expand: ORDER_EXPAND } })
    .execute();
  const order = body.results[0];
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
  return body.results.map((o) => mapOrder(o, locale));
}
