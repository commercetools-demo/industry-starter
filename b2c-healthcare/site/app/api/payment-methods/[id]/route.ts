import { handle, requireCustomer } from '@/lib/api';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { removeMethod } from '@/lib/ct/payment-methods';
import { withProvider } from '@/lib/payment-route';

/**
 * DELETE /api/payment-methods/:id[?confirm=1]. Removes a saved method; no other method is promoted to default. When an
 * active auto-refill is charged to it the answer is 409 `{ code: 'REFILL_DEPENDS', count }` and nothing is removed
 * until the same request is repeated with `confirm=1` (the refills are then paused). A method that is not the
 * customer's and an unknown id answer the same 404.
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const confirm = new URL(request.url).searchParams.get('confirm') === '1';
    const outcome = await withProvider(async () => removeMethod(session.customerId, id, await getPaymentProvider(), { confirm }));
    if (outcome.kind === 'refill-depends') {
      return Response.json({ code: 'REFILL_DEPENDS', count: outcome.count, error: 'An auto-refill is charged to this card.' }, { status: 409 });
    }
    return { methods: outcome.methods, wasDefault: outcome.wasDefault, pausedRefills: outcome.pausedRefills };
  });
}
