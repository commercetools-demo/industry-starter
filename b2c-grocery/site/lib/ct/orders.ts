import 'server-only';
import type { Order as CtOrder } from '@commercetools/platform-sdk';
import { mapOrder, mapOrderListItem } from '../mappers/order';
import type { Order, OrderListItem } from '../types';
import { getApiRoot } from './client';

const statusOf = (e: unknown): number | undefined => {
  if (typeof e !== 'object' || e === null) return undefined;
  const { statusCode, code } = e as { statusCode?: unknown; code?: unknown };
  return typeof statusCode === 'number' ? statusCode : typeof code === 'number' ? code : undefined;
};

/** A page of the customer's orders, newest first. `total` is the number of all their orders. */
export async function getCustomerOrders(
  customerId: string,
  { limit, offset, locale }: { limit: number; offset: number; locale: string },
): Promise<{ orders: OrderListItem[]; total: number }> {
  const { body } = await getApiRoot()
    .orders()
    .get({
      queryArgs: {
        // The id is interpolated into a predicate: it comes from the signed session, but strip quotes anyway.
        where: `customerId="${customerId.replace(/["\\]/g, '')}"`,
        sort: 'createdAt desc',
        limit,
        offset,
        withTotal: true,
      },
    })
    .execute();
  return { orders: body.results.map((o) => mapOrderListItem(o, { locale })), total: body.total ?? body.results.length };
}

/** Any order by id, `null` when it does not exist. Callers that answer a shopper must use `getOrderForCustomer`. */
export async function getOrderById(id: string, locale: string): Promise<Order | null> {
  let order: CtOrder;
  try {
    order = (await getApiRoot().orders().withId({ ID: id }).get().execute()).body;
  } catch (e) {
    if (statusOf(e) === 404) return null;
    throw e;
  }
  return mapOrder(order, { locale });
}

/** The single place order ownership is enforced: another customer's order (or a guest order) is `null`, same as a missing one. */
export async function getOrderForCustomer(id: string, customerId: string, locale: string): Promise<Order | null> {
  const order = await getOrderById(id, locale);
  return order && order.customerId === customerId ? order : null;
}
