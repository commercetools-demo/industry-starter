import { handle, requireCustomer } from '@/lib/api';
import { listOrdersForCustomer } from '@/lib/ct/orders-read';
import { localeOfSession } from '@/lib/order-route';

/** GET /api/orders: the signed-in customer's orders, newest first. 401 without a session; never cached. */
export async function GET(): Promise<Response> {
  return handle(async () => {
    const session = await requireCustomer();
    return { orders: await listOrdersForCustomer(session.customerId, localeOfSession(session)) };
  });
}
