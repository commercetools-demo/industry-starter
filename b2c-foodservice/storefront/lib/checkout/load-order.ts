import 'server-only';
import { canViewOrder } from '@/lib/checkout/order-access';
import { getOrderView } from '@/lib/ct/orders';
import { getSession } from '@/lib/session';
import type { OrderView } from '@/lib/types';

export type LoadedOrder = { kind: 'none' } | { kind: 'sign-in' } | { kind: 'ok'; order: OrderView; guest: boolean };

/**
 * The order for the confirmation page and who is looking at it. A missing, malformed or unreadable order is `none` (the page then
 * says "No recent order" with no hint why); a member's order seen by another session is `sign-in`; a guest order is `ok` for anyone.
 */
export async function loadOrderForPage(orderId: string, locale: string): Promise<LoadedOrder> {
  const session = await getSession();
  let order: OrderView | null;
  try {
    order = await getOrderView(orderId, locale);
  } catch {
    return { kind: 'none' };
  }
  if (!order) return { kind: 'none' };
  if (!canViewOrder(order, session)) return { kind: 'sign-in' };
  return { kind: 'ok', order, guest: !session.customerId };
}
