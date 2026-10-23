import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { planGroups } from '@/lib/checkout/fulfilment-plan';
import { orderNumberForCart, orderNumberForPart } from '@/lib/checkout/order-number';
import { readPayParts } from '@/lib/checkout/pay-cookie';
import { createCheckoutSession } from '@/lib/ct/checkout-session';
import { firstBlocker, getPaymentCart, isCollectReady, totalCentsOf } from '@/lib/ct/checkout';
import { getCartView } from '@/lib/ct/cart';
import { getOrderByNumber } from '@/lib/ct/orders';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/session { expectedTotalCents, part? } -> 200 { sessionId, projectKey, region, orderNumber, expiresAt }
 * Creates the hosted Checkout session for the cart of payment `part` (the bag itself, or one of the clone carts of a mixed
 * bag). The cart comes only from the session and the pay cookie (each re-checked for ownership); the body names none.
 * Errors: 409 totals_changed (the cart total differs from `expectedTotalCents`), 409 checkout_not_ready { missing },
 * 409 order_exists { orderId } (an order with this number already exists: go to its confirmation, never a second session),
 * 401 sign_in_required, 409 checkout_blocked, 404 cart_not_found, 502 upstream_unavailable.
 */
export const POST = handle('/api/checkout/session', async (req) => {
  const body: unknown = await req.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const expected = b.expectedTotalCents;
  if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 0) return domainError('invalid_request', 400);

  const [session, market] = await Promise.all([getSession(), getMarket()]);
  if (!session.cartId) return domainError('cart_not_found', 404);
  const parts = await readPayParts();
  const total = Math.max(parts.length, 1);
  const part = b.part === undefined ? 0 : b.part;
  if (typeof part !== 'number' || !Number.isInteger(part) || part < 0 || part >= total) return domainError('invalid_request', 400);

  const { cart: view } = await getCartView(session, market);
  if (!view) return domainError('cart_not_found', 404);
  const blocker = firstBlocker(view, session);
  if (blocker?.code === 'sign_in_required') return domainError('sign_in_required', 401);
  if (blocker) return domainError('checkout_blocked', 409, { reason: blocker.reason });

  const payCart = await getPaymentCart(session, parts.map((p) => p.id), part);
  if (!payCart || payCart.lineItems.length === 0) return domainError('checkout_not_ready', 409, { missing: ['lines'] });
  if (parts.length === 0 && planGroups(view).some((g) => g.kind === 'collect') && !isCollectReady(payCart)) {
    return domainError('checkout_not_ready', 409, { missing: ['pickup'] });
  }
  if (totalCentsOf(payCart) !== expected) return domainError('totals_changed', 409, { totalCents: totalCentsOf(payCart) });

  const orderNumber = orderNumberForPart(orderNumberForCart(session.cartId), part, total);
  const existing = await getOrderByNumber(orderNumber);
  if (existing) return domainError('order_exists', 409, { orderId: existing.id });

  const created = await createCheckoutSession({ cartId: payCart.id, orderNumber });
  return NextResponse.json(
    { sessionId: created.id, projectKey: created.projectKey, region: created.region, orderNumber, expiresAt: created.expiresAt },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
