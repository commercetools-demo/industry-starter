import 'server-only';
import { NOT_RECURRING_GENERATED, ORDER_STATUS_PREDICATE, ORDERS_PAGE_SIZE, RECURRING_SUMMARY_LIMIT, type OrderStatusFilter } from '@/lib/config/account';
import { mapOrder } from '@/lib/mappers/order';
import type { Locale, Order, RecurringSummary } from '@/lib/types';
import { getApiRoot } from './client';
import { withTimeout } from './timeout';

// Orders of the signed-in customer (D-070: no /me endpoints). Every function takes the customer id from the SESSION and filters by it;
// `getOrderForCustomer` is the ONE place that decides whether an order belongs to the buyer. Session-specific data: never cached.

/** The id comes from the signed session, but is still stripped of the characters that could break out of the predicate. */
const sanitize = (id: string): string => id.replace(/["\\]/g, '');

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'statusCode' in error && (error as { statusCode: unknown }).statusCode === 404;

export interface CustomerOrdersQuery {
  status?: OrderStatusFilter;
  /** 1-based; anything below 1 reads as 1. */
  page?: number;
  limit?: number;
}

/** Where clause of the customer's own placed orders (generated recurring orders are not listed), newest first. */
export function ordersWhere(customerId: string, status: OrderStatusFilter = 'all'): string {
  const extra = ORDER_STATUS_PREDICATE[status];
  return [`customerId="${sanitize(customerId)}"`, NOT_RECURRING_GENERATED, ...(extra ? [extra] : [])].join(' and ');
}

export async function getCustomerOrders(customerId: string, locale: Locale, query: CustomerOrdersQuery = {}): Promise<{ orders: Order[]; total: number }> {
  const limit = query.limit ?? ORDERS_PAGE_SIZE;
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const { body } = await withTimeout(
    getApiRoot()
      .orders()
      .get({ queryArgs: { where: ordersWhere(customerId, query.status), sort: 'createdAt desc', limit, offset: (page - 1) * limit, withTotal: true } })
      .execute(),
    'orders.byCustomer',
  );
  return { orders: body.results.map((order) => mapOrder(order, locale)), total: body.total ?? body.results.length };
}

/**
 * The order with this number when it belongs to `customerId`, else `null`: unknown number, another customer's order and a guest order
 * (no `customerId`, D-035) are indistinguishable to the caller (not-found, never forbidden). Every account page and route uses this.
 */
export async function getOrderForCustomer(orderNumber: string, customerId: string, locale: Locale): Promise<Order | null> {
  try {
    const { body } = await withTimeout(getApiRoot().orders().withOrderNumber({ orderNumber }).get().execute(), 'orders.byNumber');
    if (!body.customerId || body.customerId !== customerId) return null;
    return mapOrder(body, locale);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Recurring orders of the customer (summary fields only): the next bill date and which contracts have ended. */
export async function getRecurringSummaries(customerId: string): Promise<RecurringSummary[]> {
  const { body } = await withTimeout(
    getApiRoot()
      .recurringOrders()
      .get({ queryArgs: { where: `customer(id="${sanitize(customerId)}")`, limit: RECURRING_SUMMARY_LIMIT, sort: 'createdAt desc' } })
      .execute(),
    'orders.recurring',
  );
  return body.results.map((recurring) => ({
    id: recurring.id,
    originOrderId: recurring.originOrder.id,
    state: (['Active', 'Paused', 'Expired', 'Canceled', 'Failed'] as const).find((state) => state === recurring.recurringOrderState) ?? 'Failed',
    ...(recurring.nextOrderAt ? { nextOrderAt: recurring.nextOrderAt } : {}),
    ...(recurring.expiresAt ? { expiresAt: recurring.expiresAt } : {}),
  }));
}
