import { handle, requireCustomer } from '@/lib/api';
import { getOrderForCustomer } from '@/lib/ct/orders-read';
import { localeOfSession, orderNotFound } from '@/lib/order-route';

/** GET /api/orders/:id: one of the customer's orders. A foreign id and an unknown id answer the same 404 "Order not found.". */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    const { id } = await ctx.params;
    const order = await getOrderForCustomer(id, session.customerId, localeOfSession(session));
    if (!order) throw orderNotFound();
    return order;
  });
}
