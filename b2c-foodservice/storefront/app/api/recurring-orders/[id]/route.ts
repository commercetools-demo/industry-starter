import { domainError } from '@/lib/api-domain';
import { handle, requireCustomer } from '@/lib/api';
import { applyRecurringAction, getRecurringOrder } from '@/lib/ct/recurring-orders';
import { SubscriptionRejected, parseSubscriptionAction } from '@/lib/ct/subscription-plan';
import { AppError } from '@/lib/errors';
import { getMarket } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET /api/recurring-orders/[id] -> 200 { subscription }. 404 `not_found` for an unknown id and another customer's alike. */
export const GET = handle('/api/recurring-orders/[id]', async (_req, ctx) => {
  const { customerId } = await requireCustomer();
  const { id } = await ctx.params;
  const market = await getMarket();
  const subscription = await getRecurringOrder(customerId, id, market.locale);
  return Response.json({ subscription }, { headers: NO_STORE });
});

/**
 * PUT /api/recurring-orders/[id] body `{ action: 'pause' | 'resume' | 'cancel' | 'skip' }` or
 * `{ action: 'setInterval', recurrencePolicyId }` -> 200 { subscription } (the state after the change).
 * JSON only (415 otherwise). Version, customer and every commercetools field in the body are ignored. Errors: 400 invalid_request,
 * 401, 404, 409 version_conflict, 422 invalid_state | subscription_unavailable, 503 upstream_unavailable.
 */
export const PUT = handle('/api/recurring-orders/[id]', async (req, ctx) => {
  const { customerId } = await requireCustomer();
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return domainError('unsupported_media_type', 415);
  const { id } = await ctx.params;
  try {
    const action = parseSubscriptionAction(await req.json().catch(() => null));
    const market = await getMarket();
    const subscription = await applyRecurringAction(customerId, id, action, market.locale);
    return Response.json({ subscription }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof SubscriptionRejected) return domainError(e.code, e.status);
    if (e instanceof AppError && e.code === 'conflict') {
      console.error(JSON.stringify({ route: '/api/recurring-orders/[id]', recurringOrderId: id, code: 'version_conflict' }));
      return domainError('version_conflict', 409);
    }
    throw e;
  }
});
