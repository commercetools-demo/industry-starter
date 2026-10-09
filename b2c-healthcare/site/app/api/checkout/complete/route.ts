import { ApiError, handle, requireCustomer } from '@/lib/api';
import { finalizeOrder } from '@/lib/ct/orders';
import { orderBelongsTo } from '@/lib/ct/orders-read';
import { NO_STORE } from '@/lib/rx-route';
import { clearCart } from '@/lib/session';

/**
 * POST /api/checkout/complete `{ orderId }`: the browser's `checkout_completed` callback. Checkout has created the
 * order; this runs the domain logic once for it (`finalizeOrder`: prescription, allowance, `MLV-` number, state) and
 * answers `{ orderId, orderNumber }` so the page can go to `/order/<id>`. The browser's word is never trusted for anything
 * but the id: the order must be the signed-in customer's (a foreign and an unknown id are the same 404) and everything
 * is read from the platform. Repeating the call, or racing the lazy finalize on the order page or the subscription
 * route, is safe: the answer is the same order. Failures keep the order (it exists) and answer `{ code }`.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
    const orderId = body?.orderId;
    if (typeof orderId !== 'string' || !/^[\w-]{1,64}$/.test(orderId)) throw new ApiError(400, 'The request could not be processed.');
    if (!(await orderBelongsTo(orderId, session.customerId))) throw new ApiError(404, 'Order not found.');
    const outcome = await finalizeOrder(orderId);
    if (!outcome.ok) {
      const status = outcome.code === 'IN_PROGRESS' ? 409 : outcome.code === 'NOT_FOUND' ? 404 : outcome.code === 'PLACEMENT_FAILED' ? 502 : 422;
      return Response.json({ code: outcome.code, orderId }, { status, headers: NO_STORE });
    }
    await clearCart();
    return Response.json({ orderId: outcome.orderId, orderNumber: outcome.orderNumber }, { headers: NO_STORE });
  });
}
