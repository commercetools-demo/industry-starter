import 'server-only';
import { getOrderByNumber } from '@/lib/ct/account-orders';
import { mapOrderDetail } from '@/lib/mappers/account-order';
import type { OrderDetailView } from '@/lib/types';

/** Order numbers are `[A-Za-z0-9_-]`; anything else is treated as unknown without a call. */
export const ORDER_NUMBER = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The customer's order by number as a view, or null when it is unknown OR belongs to someone else (the two are
 * indistinguishable on purpose). Used by the order route and the order page.
 */
export async function loadAccountOrder(customerId: string, orderNumber: string, locale: string): Promise<OrderDetailView | null> {
  if (!ORDER_NUMBER.test(orderNumber)) return null;
  const order = await getOrderByNumber(customerId, orderNumber);
  return order ? mapOrderDetail(order, locale) : null;
}
