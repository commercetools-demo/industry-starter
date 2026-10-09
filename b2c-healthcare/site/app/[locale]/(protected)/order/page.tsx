import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderOutcomeUnknown } from '@/components/orders/OrderOutcomeUnknown';
import { redirect } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }>; searchParams?: Promise<{ orderId?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orders' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * `/order` without an id: the place request got no answer, so nobody knows whether the order exists. The page does
 * not say "placed" (it has not read an order); it sends the buyer to the order list, where an order that was
 * created shows up, instead of inviting a second payment.
 *
 * Checkout's "Payment return URL" (a redirect-based payment method) points here and appends `?orderId=<id>`: that
 * order exists, so the buyer is sent to its page (which finalizes the order lazily if the browser never called back).
 */
export default async function OrderUnknownRoute({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const orderId = (await searchParams)?.orderId;
  if (typeof orderId === 'string' && /^[\w-]{1,64}$/.test(orderId)) redirect({ href: `/order/${encodeURIComponent(orderId)}`, locale });
  return <OrderOutcomeUnknown />;
}
