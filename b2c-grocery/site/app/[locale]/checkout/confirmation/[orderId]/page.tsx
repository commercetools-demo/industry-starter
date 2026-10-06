import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderConfirmation } from '@/components/checkout/OrderConfirmation';
import { getOrderById } from '@/lib/ct/orders';
import { getSession } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout.confirmation' });
  return { title: t('titleNoName'), robots: { index: false } };
}

/**
 * Confirmation for the order just placed. Allowed for the signed-in customer who owns the order, or (guests) for the
 * order the session just completed (`lastOrderId`); everything else is a 404 that looks like a missing order.
 * The `private, no-store` header comes from `next.config.ts` (`/:locale/checkout/:path*`).
 */
export default async function ConfirmationPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  const order = await getOrderById(orderId, locale);
  const isOwner = Boolean(order?.customerId) && order?.customerId === session.customerId;
  // notFound() throws; it must stay outside any try/catch.
  if (!order || !(isOwner || session.lastOrderId === orderId)) notFound();
  return <OrderConfirmation order={order} firstName={session.customerFirstName || order.shippingAddress?.firstName || undefined} canTrack={isOwner} />;
}
