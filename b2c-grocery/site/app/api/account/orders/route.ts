import { privateJson, unauthenticated } from '@/lib/api/private-json';
import { getCustomerOrders } from '@/lib/ct/orders';
import { ORDERS_PAGE_SIZE, parsePage } from '@/lib/orders-paging';
import { getMarket, getSession } from '@/lib/session';

/** The signed-in customer's orders, newest first, 10 per page (`?page=`). Checks the session itself (the layout guards pages only). */
export async function GET(request: Request) {
  const { customerId } = await getSession();
  if (!customerId) return unauthenticated();
  const page = parsePage(new URL(request.url).searchParams.get('page'));
  try {
    const { locale } = await getMarket();
    const { orders, total } = await getCustomerOrders(customerId, { limit: ORDERS_PAGE_SIZE, offset: (page - 1) * ORDERS_PAGE_SIZE, locale });
    return privateJson({ orders, total, page, pageSize: ORDERS_PAGE_SIZE });
  } catch (e) {
    console.error('Orders request failed', e instanceof Error ? e.message : e);
    return privateJson({ error: 'ORDERS_ERROR' }, { status: 500 });
  }
}
