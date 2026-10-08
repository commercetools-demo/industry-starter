import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderConfirmation } from '@/components/orders/OrderConfirmation';
import { getOrderForCustomer } from '@/lib/ct/orders-read';
import { requireSessionOrPrompt } from '@/lib/require-session';

type Props = { params: Promise<{ locale: string; id: string }> };

// Never indexed; the title carries no order data.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orders' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * The order, read fresh from the order itself on every request (a reload, a bookmark or a later visit shows the
 * current state; nothing depends on the cart or the session that placed it). Another customer's id and an id that
 * does not exist both end in `notFound()`: the same 404 and the same "Order not found.".
 */
export default async function OrderRoute({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('order', `/order/${encodeURIComponent(id)}`);
  if (!gate.signedIn) return gate.prompt;
  const order = await getOrderForCustomer(id, gate.customerId, locale);
  if (!order) notFound();
  return <OrderConfirmation order={order} />;
}
