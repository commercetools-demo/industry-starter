import { NextResponse } from 'next/server';
import { handle, jsonError, requireCustomer } from '@/lib/api';
import { getOrderById } from '@/lib/ct/account-orders';
import { runReorder } from '@/lib/ct/reorder';
import { createSessionToken, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ORDER_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * POST /api/orders/[id]/reorder (Buy again) -> 200 { added, skipped, cart }. The lines are ADDED to the shopper's current
 * bag; unavailable ones are listed with a reason (`unavailable`, `out_of_stock`, `not_found`, `price_missing`). A foreign or
 * unknown order is the same 404. The session cookie carries the (possibly new) cart id.
 */
export const POST = handle('/api/orders/[id]/reorder', async (_req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  if (!ORDER_ID.test(id)) return jsonError('not_found', 404);
  const order = await getOrderById(customerId, id);
  if (!order) return jsonError('not_found', 404);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  const { result, session: next } = await runReorder(session, market, order);
  return setSessionCookie(
    NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } }),
    await createSessionToken(next),
  );
});
