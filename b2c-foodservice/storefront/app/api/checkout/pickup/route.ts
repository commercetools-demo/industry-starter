import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { domainError } from '@/lib/api-domain';
import { planGroups } from '@/lib/checkout/fulfilment-plan';
import { setPayCartIds } from '@/lib/checkout/pay-cookie';
import { blockingIssues } from '@/lib/checkout/summary';
import { validatePickup } from '@/lib/checkout/validate';
import { CheckoutNotReady, firstBlocker, getCheckoutState, preparePayments } from '@/lib/ct/checkout';
import { SAFE_MESSAGES } from '@/lib/errors';
import { getMarket, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/checkout/pickup { person: 'me' | 'other', pickupName } -> 200 CheckoutState with `payments` (the carts to pay, in order).
 * The pickup person is required only when the bag has a collect group (never in a Canada session: ignored there). The body never
 * names a cart. Errors: 422 validation_failed { fields }, 409 collect_out_of_stock, 409 collect_not_available, 409 checkout_blocked,
 * 401 sign_in_required, 404 cart_not_found, 409 cart_empty. The names are personal data: never logged.
 */
export const PUT = handle('/api/checkout/pickup', async (req) => {
  const body: unknown = await req.json().catch(() => null);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const [session, market] = await Promise.all([getSession(), getMarket()]);

  const read = await getCheckoutState(session, market);
  const state = read.state;
  if (!state) return domainError('cart_not_found', 404);
  if (state.cart.lines.length === 0) return domainError('cart_empty', 409);

  const groups = planGroups(state.cart);
  const collectInBag = groups.some((g) => g.kind === 'collect');
  const fields = validatePickup({ person: b.person, pickupName: b.pickupName }, collectInBag);
  if (Object.keys(fields).length > 0) {
    return Response.json({ error: { code: 'validation_failed', message: SAFE_MESSAGES.validation_failed, fields } }, { status: 422 });
  }

  const issue = blockingIssues(state.issues)[0];
  if (issue?.code === 'collect_out_of_stock') return domainError('collect_out_of_stock', 409, { lineId: issue.lineId });
  if (issue?.code === 'collect_not_available') return domainError('collect_not_available', 409, { lineId: issue.lineId });
  if (issue) return domainError('checkout_blocked', 409, { reason: issue.code, lineId: issue.lineId });
  const blocker = firstBlocker(state.cart, read.session);
  if (blocker?.code === 'sign_in_required') return domainError('sign_in_required', 401);
  if (blocker) return domainError('checkout_blocked', 409, { reason: blocker.reason });

  const pickupName = collectInBag && typeof b.pickupName === 'string' ? b.pickupName.trim() : null;
  try {
    const prepared = await preparePayments(read.session, market, {
      pickupName,
      ...(read.session.customerEmail ? { email: read.session.customerEmail } : {}),
    });
    const after = await getCheckoutState(read.session, market);
    const payload = { ...(after.state ?? state), payments: prepared.payments };
    return setPayCartIds(NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } }), prepared.payCartIds);
  } catch (e) {
    if (e instanceof CheckoutNotReady) return domainError('checkout_not_ready', 409, { missing: e.missing });
    throw e;
  }
});
