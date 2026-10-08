import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderDetail } from '@/components/account/OrderDetail';
import { requireCustomerPage } from '@/lib/auth/guard';
import { isLocale } from '@/lib/config/markets';
import { getOrderForCustomer } from '@/lib/ct/orders';
import { postPurchaseNow } from '@/lib/orders/now';

// Session-specific: read on every request, never cached, never indexed.
export const dynamic = 'force-dynamic';

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type Props = { params: Promise<{ locale: string; orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  // Only the number from the URL: nothing about the order is read before ownership is proven.
  return { title: t('order.heading', { orderNumber: decode(orderNumber) }), robots: { index: false, follow: false } };
}

export default async function OrderPage({ params }: Props) {
  const { locale, orderNumber: rawNumber } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const orderNumber = decode(rawNumber);
  const { customer } = await requireCustomerPage(locale, `/account/orders/${encodeURIComponent(orderNumber)}`);
  // The one ownership check: a number that is unknown, another customer's or a guest's gives null, and nothing is rendered from it.
  const order = await getOrderForCustomer(orderNumber, customer.id, locale);
  if (!order) notFound();
  const customerName = [customer.firstName, customer.lastName].map((part) => part?.trim() ?? '').filter(Boolean).join(' ');
  // The cancel and return windows are decided from one clock read on the server (DEV_NOW_OFFSET_DAYS only moves it in `next dev`).
  return <OrderDetail order={order} customerName={customerName} nowIso={postPurchaseNow().toISOString()} />;
}
