import 'server-only';
import { cache } from 'react';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api-error';
import { DASHBOARD_ORDERS_LIMIT, NOT_RECURRING_GENERATED, ORDER_STATUS_PREDICATE, ORDERS_PAGE_SIZE, RECURRING_SUMMARY_LIMIT, type OrderStatusFilter } from '@/lib/config/account';
import { mapOrder } from '@/lib/mappers/order';
import type { Locale, Order, RecurringSummary, ReorderUnavailable } from '@/lib/types';
import { getCartById, updateCart } from './cart';
import { getApiRoot } from './client';
import { planReorder } from './reorder';
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

/**
 * One read per request for every dashboard panel that needs the orders (Recent orders, Current contract, Your plans, Monthly bill):
 * they share the answer and fail together by design. React `cache` only deduplicates inside one request; nothing is shared between buyers.
 */
export const getCustomerOrdersCached: (customerId: string, locale: Locale) => Promise<Order[]> = cache(async (customerId, locale) => (await getCustomerOrders(customerId, locale, { limit: DASHBOARD_ORDERS_LIMIT })).orders);

/** The recurring-orders read of the dashboard (separate from the orders read: its failure only affects the next bill date). */
export const getRecurringSummariesCached: (customerId: string) => Promise<RecurringSummary[]> = cache(getRecurringSummaries);

/**
 * The SKUs of the published products with these keys (what the catalog sells today), or `null` when there is nothing to look up.
 * Replicate Cart keeps a line whose product was unpublished (verified live), so the SKU comparison alone is not enough.
 */
async function getPublishedSkus(productKeys: string[]): Promise<Set<string> | null> {
  const keys = [...new Set(productKeys.filter((key) => key !== ''))];
  if (keys.length === 0) return null;
  const where = `key in (${keys.map((key) => `"${sanitize(key)}"`).join(',')})`;
  const { body } = await withTimeout(getApiRoot().productProjections().get({ queryArgs: { where, limit: 500 } }).execute(), 'orders.published');
  return new Set(body.results.flatMap((product) => [product.masterVariant, ...product.variants].flatMap((variant) => (variant.sku ? [variant.sku] : []))));
}

/**
 * "Buy again": Replicate Cart from the order (a replicated cart is priced from today's catalog), then the plan of `planReorder`: lines that
 * could not be reused are removed and returned as `unavailable`, parent links and order-only custom fields are repaired. The caller has
 * already proved ownership (`getOrderForCustomer`); the customer's previous active cart is left alone. Returns the fresh, expanded cart.
 */
export async function replicateOrderToCart(order: Order): Promise<{ cart: CtCart; unavailable: ReorderUnavailable[] }> {
  const { body: replica } = await withTimeout(
    getApiRoot().carts().replicate().post({ body: { reference: { typeId: 'order', id: order.id } } }).execute(),
    'orders.replicate',
  );
  const { actions, unavailable } = planReorder(order, replica, await getPublishedSkus(replica.lineItems.map((line) => line.productKey ?? '')));
  if (actions.length > 0) await updateCart(replica, actions);
  const cart = await getCartById(replica.id);
  if (!cart) throw new ApiError('INTERNAL', 'The new bundle could not be read');
  return { cart, unavailable };
}
