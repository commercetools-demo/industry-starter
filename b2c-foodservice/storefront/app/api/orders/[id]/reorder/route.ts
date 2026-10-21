import { NextResponse } from 'next/server';
import { handle, jsonError, requireCustomer } from '@/lib/api';
import { ORDER_ID_PATTERN } from '@/lib/checkout/order-access';
import { getCustomerOrderById } from '@/lib/ct/orders';
import { runReorder } from '@/lib/ct/reorder';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/reorder (Buy again) -> 200 { added, skipped, cart }. The lines are ADDED to the shopper's current
 * bag; unavailable ones are listed with a reason (`unavailable`, `out_of_stock`, `not_found`, `price_missing`). A foreign or
 * unknown order is the same 404. The session cookie carries the (possibly new) cart id.
 */
export const POST = handle('/api/orders/[id]/reorder', async (_req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  if (!ORDER_ID_PATTERN.test(id)) return jsonError('not_found', 404);
  const order = await getCustomerOrderById(customerId, id);
  if (!order) return jsonError('not_found', 404);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const { result, session: next } = await runReorder(session, market, order);
  return setSessionCookie(
    NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } }),
    await createSessionToken(next),
  );
});
