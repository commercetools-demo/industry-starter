import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { recurringFailure, subscriptionsOff } from '@/lib/api/recurring-api';
import { subscriptionsEnabled } from '@/lib/config/features';
import { getRecurrencePolicies } from '@/lib/ct/recurrence-policies';
import { getRecurringOrders } from '@/lib/ct/recurring-orders';
import { getMarket, getSession } from '@/lib/session';
import type { RecurringOrdersResponse } from '@/lib/types';

/**
 * The signed-in customer's recurring orders (newest first) and the cadences they can switch to. 404 while subscriptions
 * are off. Checks the session itself (the layout guards pages only).
 */
export async function GET() {
  if (!subscriptionsEnabled()) return subscriptionsOff();
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  try {
    const { locale } = await getMarket();
    const [recurringOrders, policies] = await Promise.all([getRecurringOrders(customerId, locale), getRecurrencePolicies(locale)]);
    const body: RecurringOrdersResponse = { recurringOrders, policies: policies.map(({ key, name }) => ({ key, name })) };
    return privateJson(body);
  } catch (e) {
    return recurringFailure(e);
  }
}
