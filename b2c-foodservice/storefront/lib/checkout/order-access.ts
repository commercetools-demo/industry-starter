import type { OrderView } from '@/lib/types';

/** An order id is a commercetools id (a UUID); anything else is refused before a call is made. */
export const ORDER_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Who may see an order (Q-K-14). An order with a `customerId` belongs to that customer's session only; a guest order
 * (no `customerId`) is shown to whoever holds its id (a UUID).
 */
export function canViewOrder(order: Pick<OrderView, 'customerId'>, session: { customerId?: string }): boolean {
  return order.customerId === null || order.customerId === session.customerId;
}
