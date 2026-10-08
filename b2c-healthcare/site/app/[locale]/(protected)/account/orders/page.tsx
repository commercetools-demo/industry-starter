import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountHeading } from '@/components/account/AccountShell';
import { OrderList } from '@/components/orders/OrderList';
import { listOrdersForCustomer } from '@/lib/ct/orders-read';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.orders');
  return pageMetadata({ locale, path: '/account/orders', title: t('title'), noindex: true });
}

/**
 * The signed-in customer's orders, newest first (query by customer id; nobody else's order can appear). Each card
 * links to the order page (`Track`) and offers Reorder. The overview tile counts the same orders (`countOrders`).
 */
export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account/orders');
  if (!gate.signedIn) return gate.prompt;
  const t = await getTranslations('account.orders');
  const orders = await listOrdersForCustomer(gate.customerId, locale).catch(() => null);
  return (
    <>
      <AccountHeading title={t('title')} />
      <OrderList orders={orders} />
    </>
  );
}
