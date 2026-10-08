import { handle, requireCustomer } from '@/lib/api';
import { PaymentUnavailableError, type PaymentProvider } from '@/lib/checkout/payment-provider';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { cancelOrderForCustomer } from '@/lib/ct/order-cancel';
import { localeOfSession, orderNotFound } from '@/lib/order-route';

/** The payment service may be unconfigured or down: cancelling must not depend on it (the refund marker is on the payment). */
async function providerOrNull(): Promise<PaymentProvider | null> {
  try {
    return await getPaymentProvider();
  } catch (error) {
    if (error instanceof PaymentUnavailableError) return null;
    throw error;
  }
}

/**
 * POST /api/orders/:id/cancel: the signed-in customer cancels their own order until it is packed and shipped. Gives
 * the prescription refill back (once), marks the payment for refund and releases the authorization. A foreign and an
 * unknown id answer the same 404 "Order not found."; an order past `mlv-pharmacist-review` answers 409 `too-late`.
 * Answers the order as the order page shows it.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const outcome = await cancelOrderForCustomer(id, session.customerId, await providerOrNull(), localeOfSession(session));
    if (outcome.kind === 'not-found') throw orderNotFound();
    if (outcome.kind === 'too-late') return Response.json({ error: 'This order is already packed and can no longer be cancelled.', code: 'too-late' }, { status: 409 });
    return outcome.order;
  });
}
