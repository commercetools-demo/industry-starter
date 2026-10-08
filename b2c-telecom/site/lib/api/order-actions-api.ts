import 'server-only';
import type { NextResponse } from 'next/server';
import { AccountRefusal, accountRoute, readJsonBody } from '@/lib/api/account-api';
import { NotCancellableError, OrderNotFoundError, ReturnInputError, ReturnNotAllowedError } from '@/lib/ct/post-purchase';
import { getMarket } from '@/lib/market/server';
import type { Locale, Order } from '@/lib/types';

// Shared by POST /api/orders/[orderNumber]/cancel and /return (workstream V): sign-in (401), same origin, the shape of an order number
// (404 before anything is read), the JSON body, and the mapping of the post-purchase errors to this API's stable codes.
// The note a buyer types is never logged: only error names are (see account-api).

/** Anything an order number from the store can look like (QA and demo orders included); ownership is proven by the lookup, not by this. */
const ORDER_NUMBER_SHAPE = /^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/;

type Handler = (args: { orderNumber: string; customerId: string; body: Record<string, unknown>; locale: Locale }) => Promise<Order>;

const notFound = (): AccountRefusal => new AccountRefusal(404, 'ORDER_NOT_FOUND', 'Order not found');

export async function orderActionRoute(
  request: Request,
  params: Promise<{ orderNumber: string }>,
  failureCode: 'CANCEL_FAILED' | 'RETURN_FAILED',
  run: Handler,
): Promise<NextResponse> {
  return accountRoute(request, { mutating: true }, async ({ session }) => {
    const { orderNumber } = await params;
    if (!ORDER_NUMBER_SHAPE.test(orderNumber)) throw notFound();
    const body = await readJsonBody(request);
    const { locale } = await getMarket();
    try {
      return { order: await run({ orderNumber, customerId: session.customerId, body, locale }) };
    } catch (error) {
      if (error instanceof OrderNotFoundError) throw notFound();
      if (error instanceof NotCancellableError) throw new AccountRefusal(409, 'NOT_CANCELLABLE', 'This order cannot be cancelled online', { block: error.block });
      if (error instanceof ReturnNotAllowedError) throw new AccountRefusal(409, error.code, 'A return is not possible for this order');
      if (error instanceof ReturnInputError) throw new AccountRefusal(400, error.code, 'The return request is not valid');
      if (error instanceof AccountRefusal) throw error;
      console.error('[order-actions] failed', error instanceof Error ? error.name : 'unknown');
      throw new AccountRefusal(502, failureCode, 'The request could not be completed, try again');
    }
  });
}
