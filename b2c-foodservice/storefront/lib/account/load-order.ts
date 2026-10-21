import 'server-only';
import { ensureOrderState, getCustomerOrderByNumber } from '@/lib/ct/orders';
import { mapOrder } from '@/lib/mappers/order';
import type { OrderView } from '@/lib/types';

/** Order numbers are `[A-Za-z0-9_-]`; anything else is treated as unknown without a call. */
export const ORDER_NUMBER = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The customer's order by number as a view, or null when it is unknown OR belongs to someone else (the two are
 * indistinguishable on purpose). Used by the order route and the order page.
 */
export async function loadAccountOrder(customerId: string, orderNumber: string, locale: string): Promise<OrderView | null> {
  if (!ORDER_NUMBER.test(orderNumber)) return null;
  const order = await getCustomerOrderByNumber(customerId, orderNumber);
  // Like the confirmation page: an order the hosted Checkout created without a state gets `ordered` first (Q-K-05).
  return order ? mapOrder(await ensureOrderState(order), { locale, now: new Date() }) : null;
}
