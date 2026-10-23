import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { ORDER_ID_PATTERN, canViewOrder } from '@/lib/checkout/order-access';
import { getOrderView } from '@/lib/ct/orders';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/[id] -> 200 { order: OrderView } (workstream K). A guest order is shown to whoever holds its id; a member's
 * order only to the owning session. Another customer's order and an unknown id answer the same `404 order_not_found`.
 * The order is shown as stored, so a revisit later needs no cart. Never cached.
 */
export const GET = handle('/api/orders/[id]', async (_req, ctx) => {
  const { id } = await ctx.params;
  if (!id || !ORDER_ID_PATTERN.test(id)) return domainError('order_not_found', 404);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const order = await getOrderView(id, market.locale);
  if (!order || !canViewOrder(order, session)) return domainError('order_not_found', 404);
  return Response.json({ order }, { headers: { 'Cache-Control': 'no-store' } });
});
