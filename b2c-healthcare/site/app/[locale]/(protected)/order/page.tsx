import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderOutcomeUnknown } from '@/components/orders/OrderOutcomeUnknown';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orders' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * `/order` without an id: the place request got no answer, so nobody knows whether the order exists. The page does
 * not say "placed" (it has not read an order); it sends the buyer to the order list, where an order that was
 * created shows up, instead of inviting a second payment.
 */
export default async function OrderUnknownRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OrderOutcomeUnknown />;
}
