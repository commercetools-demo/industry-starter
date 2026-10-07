import { ApiError } from '@/lib/api-error';
import { requireCustomerApi } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/origin';
import { mapForMarket } from '@/lib/ct/bundle';
import { errorResponse, json } from '@/lib/ct/http';
import { getOrderForCustomer, replicateOrderToCart } from '@/lib/ct/orders';
import { updateSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';
import type { ReorderResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * "Buy again". The customer is the signed session's (D-070); the order number from the URL is only a request to read one of THEIR
 * orders (`getOrderForCustomer`: foreign, guest and unknown orders are the same 404). The new cart becomes the session's cart; the
 * previous active cart stays with the customer. `unavailable` lists every line that could not be reused (removed, never silent).
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  try {
    assertSameOrigin(request);
    const { session } = await requireCustomerApi();
    const { orderNumber } = await params;
    const market = await getMarket();
    const order = await getOrderForCustomer(orderNumber, session.customerId, market.locale);
    if (!order) throw new ApiError('NOT_FOUND', 'Order not found', { reason: 'ORDER_NOT_FOUND' });
    if (order.total.currencyCode !== market.currency) {
      throw new ApiError('CONFLICT', 'This order was placed in another currency', { reason: 'MARKET_MISMATCH' });
    }
    const { cart: replica, unavailable } = await replicateOrderToCart(order);
    const { cart } = await mapForMarket(replica, market);
    const result: ReorderResult = { cart, unavailable };
    const response = json(result);
    await updateSession({ cartId: replica.id }, response);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
