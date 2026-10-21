import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import OrderDetail from '@/components/account/orders/OrderDetail';
import { loadAccountOrder } from '@/lib/account/load-order';
import { requireCustomerPage } from '@/lib/auth/require-customer';

export const dynamic = 'force-dynamic';

/**
 * Order detail. The order is read on the server with the ownership check: an unknown and a foreign number both end in
 * `notFound()` (HTTP 404, the "We couldn't find that order" card of `not-found.tsx`, no order data in the response).
 */
export default async function AccountOrderPage({ params }: { params: Promise<{ locale: string; orderNumber: string }> }) {
  const { locale, orderNumber: raw } = await params;
  setRequestLocale(locale);
  const orderNumber = decodeURIComponent(raw);
  const { customerId } = await requireCustomerPage(`/account/orders/${encodeURIComponent(orderNumber)}`);
  const order = await loadAccountOrder(customerId, orderNumber, locale);
  if (!order) notFound();
  return <OrderDetail orderNumber={order.orderNumber} initial={order} />;
}
