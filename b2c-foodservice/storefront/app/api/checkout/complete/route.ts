import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { finalizeWithPolling } from '@/lib/checkout/finalize';
import { orderNumberForCart, orderNumberForPart } from '@/lib/checkout/order-number';
import { readPayParts } from '@/lib/checkout/pay-cookie';
import { afterPlacement, applyPlacement } from '@/lib/checkout/placed';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/complete { part? } -> 200 { orderId, next } (called after the hosted flow reports `checkout_completed`).
 * Finalises the order of the session's bag for payment `part`: polls up to 5 times, 1 s apart, for an order with the bag's
 * deterministic number, makes sure it has the `ordered` state, runs the post-order hooks. `next` is the index of the payment
 * still to make (complete-per-group) or null: only then is the bag emptied (`cartId` leaves the session). Idempotent.
 * Errors: 404 cart_not_found, 404 order_not_found (the client shows its retry path), 502 upstream_unavailable.
 */
export const POST = handle('/api/checkout/complete', async (req) => {
  const body: unknown = await req.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const session = await getSession();
  if (!session.cartId) return domainError('cart_not_found', 404);
  const parts = await readPayParts();
  const total = Math.max(parts.length, 1);
  const part = b.part === undefined ? 0 : b.part;
  if (typeof part !== 'number' || !Number.isInteger(part) || part < 0 || part >= total) return domainError('invalid_request', 400);

  const orderNumber = orderNumberForPart(orderNumberForCart(session.cartId), part, total);
  const order = await finalizeWithPolling({ orderNumber });
  if (!order) return domainError('order_not_found', 404);

  const placement = await afterPlacement(session, parts, order);
  const res = NextResponse.json({ orderId: order.id, next: placement.next }, { headers: { 'Cache-Control': 'no-store' } });
  return applyPlacement(res, placement);
});
