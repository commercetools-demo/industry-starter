import { handle, requireCustomer } from '@/lib/api';
import { listPendingSubscriptions, listRecurringOrders } from '@/lib/ct/recurring-orders';
import { UUID } from '@/lib/ct/subscription-plan';
import { AppError } from '@/lib/errors';
import { mapRecurringOrder } from '@/lib/mappers/recurring-order';
import { getMarket } from '@/lib/session';
import type { SubscriptionsResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recurring-orders[?originOrderId=<uuid>] -> 200 { subscriptions, pending }, newest first (workstream N).
 * The customer is always the session's. `originOrderId` narrows the list to the recurring orders created from one order (the
 * confirmation page) and does not compute `pending` unless that order has none. 401 with no detail without a session.
 */
export const GET = handle('/api/recurring-orders', async (req) => {
  const { customerId } = await requireCustomer();
  const origin = new URL(req.url).searchParams.get('originOrderId');
  if (origin !== null && !UUID.test(origin)) throw new AppError('bad_request', 400);
  const market = await getMarket();
  const all = (await listRecurringOrders(customerId)).map((r) => mapRecurringOrder(r, market.locale));
  const subscriptions = origin ? all.filter((s) => s.originOrderId === origin) : all;
  const pending = (await listPendingSubscriptions(customerId, all, market.locale)).filter((p) => !origin || (p.orderId === origin && subscriptions.length === 0));
  const body: SubscriptionsResponse = { subscriptions, pending };
  return Response.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
});
