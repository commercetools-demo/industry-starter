import { NextResponse } from 'next/server';
import { jsonError, readJson } from '@/lib/cart-api';
import { getOrderRef } from '@/lib/ct/orders';
import { getSession, updateSession } from '@/lib/session';
import { getSlotService } from '@/lib/slots';

const noStore = (res: NextResponse): NextResponse => {
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
};
const fail = (error: string, status: number) => noStore(jsonError(error, status));

/**
 * Hand-off after the hosted checkout created the order. The order must come from the session's cart (403 otherwise);
 * the session then remembers `lastOrderId` and forgets `cartId`, and the slot booking is confirmed best-effort
 * (D-042: a failure is logged, never fatal). Calling it again for the same order is a no-op that answers the same.
 */
export async function POST(request: Request) {
  const { orderId } = await readJson(request);
  if (typeof orderId !== 'string' || orderId === '') return fail('INVALID_ORDER', 400);

  const session = await getSession();
  if (!session.cartId && session.lastOrderId === orderId) return noStore(NextResponse.json({ orderId }));
  if (!session.cartId) return fail('NO_CART', 400);

  try {
    const order = await getOrderRef(orderId);
    if (!order) return fail('ORDER_NOT_FOUND', 404);
    if (order.cartId !== session.cartId) return fail('FORBIDDEN', 403);

    if (order.slotId) {
      try {
        await getSlotService().confirmBooking(order.slotId, order.id, session.cartId);
      } catch (e) {
        console.error('Slot booking confirmation failed', e instanceof Error ? e.message : e);
      }
    }

    const res = noStore(NextResponse.json({ orderId: order.id }));
    await updateSession({ lastOrderId: order.id, cartId: undefined }, res);
    return res;
  } catch (e) {
    console.error('Checkout completion failed', e instanceof Error ? e.message : e);
    return fail('CHECKOUT_ERROR', 500);
  }
}
