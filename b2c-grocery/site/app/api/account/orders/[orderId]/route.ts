import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { getOrderForCustomer } from '@/lib/ct/orders';
import { getMarket, getSession } from '@/lib/session';

type Context = { params: Promise<{ orderId: string }> };

/** One order of the signed-in customer. An order that is not theirs answers exactly like a missing one (404). */
export async function GET(_request: Request, { params }: Context) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const { orderId } = await params;
  try {
    const { locale } = await getMarket();
    const order = await getOrderForCustomer(orderId, customerId, locale);
    if (!order) return privateJson({ error: 'ORDER_NOT_FOUND' }, { status: 404 });
    return privateJson({ order });
  } catch (e) {
    console.error('Order request failed', e instanceof Error ? e.message : e);
    return privateJson({ error: 'ORDERS_ERROR' }, { status: 500 });
  }
}
