import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { afterPlacement, applyPlacement } from '@/lib/checkout/placed';
import { parseInstoreForm } from '@/lib/checkout/instore-form';
import { placeInstoreOrder } from '@/lib/ct/instore-order';
import { isInstore } from '@/lib/app-mode';
import { AppError } from '@/lib/errors';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/free { who: { mode: 'name', name } | { mode: 'badge' }, notify: { mode: 'email', email } | { mode: 'phone', phone } }
 * -> 200 { orderId } (D-062). The In-store companion's checkout: the booth order is free, so the session's bag becomes an order
 * with no payment, and the bag leaves the session. The cart is read only from the session; the body never names one. The website
 * has no such route (404). Idempotent: the order number is the bag's, so a repeat finds the first order.
 * Errors: 400 invalid_request, 404 cart_not_found / not_found, 409 cart_empty.
 */
export const POST = handle('/api/checkout/free', async (req) => {
  if (!isInstore()) return domainError('not_found', 404);
  const form = parseInstoreForm(await req.json().catch(() => null));
  if (!form) return domainError('invalid_request', 400);
  const [session, market] = await Promise.all([getSession(), getMarket()]);
  if (!session.cartId) return domainError('cart_not_found', 404);
  let order;
  try {
    order = await placeInstoreOrder(session, market.country, form);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') return domainError('cart_not_found', 404);
    if (e instanceof AppError && e.code === 'validation_failed') return domainError('cart_empty', 409);
    throw e;
  }
  const placement = await afterPlacement(session, [], order);
  const res = NextResponse.json({ orderId: order.id }, { headers: { 'Cache-Control': 'no-store' } });
  return applyPlacement(res, placement);
});
