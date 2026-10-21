import { handle, jsonError, requireCustomer } from '@/lib/api';
import { loadAccountOrder } from '@/lib/account/load-order';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/number/<orderNumber> -> 200 { order: OrderDetailView } with deliveries, returns and return eligibility.
 * An unknown and a foreign order number answer the identical `404 not_found`. 401 without a session, with no detail.
 * (Named `number/` so it cannot collide with K's `GET /api/orders/[id]`; see Q-L-16.)
 */
export const GET = handle('/api/orders/number/[orderNumber]', async (_req, ctx) => {
  const { customerId } = await requireCustomer();
  const { orderNumber } = await ctx.params;
  const { locale } = await getMarket();
  const order = await loadAccountOrder(customerId, orderNumber, locale);
  if (!order) return jsonError('not_found', 404);
  return Response.json({ order }, { headers: { 'Cache-Control': 'no-store' } });
});
