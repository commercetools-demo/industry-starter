import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import NoRecentOrder from '@/components/order/NoRecentOrder';
import OrderConfirmation from '@/components/order/OrderConfirmation';
import { redirect } from '@/i18n/routing';
import { ORDER_ID_PATTERN } from '@/lib/checkout/order-access';
import { loadOrderForPage } from '@/lib/checkout/load-order';
import { signInHref } from '@/lib/routes';

/** The order is shown as stored, per request, never cached (the state changes in the store) and never indexed. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'order' });
  return { title: t('confirmed'), robots: { index: false, follow: false } };
}

/**
 * `/[locale]/checkout/confirmation/[orderId]`: rendered from the stored order, never from the cart. A member's order needs the
 * owning session (otherwise sign-in, then back here); a guest order is shown to whoever holds the id (a UUID). A missing, malformed
 * or unreadable order is "No recent order" with HTTP 200, with no detail about why.
 */
export default async function ConfirmationRoute({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  setRequestLocale(locale);
  if (!ORDER_ID_PATTERN.test(orderId)) return <NoRecentOrder locale={locale} />;
  const loaded = await loadOrderForPage(orderId, locale);
  if (loaded.kind === 'none') return <NoRecentOrder locale={locale} />;
  if (loaded.kind === 'sign-in') {
    redirect({ href: signInHref(`/checkout/confirmation/${orderId}`), locale });
  }
  if (loaded.kind !== 'ok') return null;
  return <OrderConfirmation initial={loaded.order} guest={loaded.guest} />;
}
