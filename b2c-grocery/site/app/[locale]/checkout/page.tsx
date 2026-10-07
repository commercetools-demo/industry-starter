import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { redirect } from '@/i18n/routing';
import { getMappedCart } from '@/lib/ct/cart';
import { getMarket, getSession } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('title'), robots: { index: false } };
}

/**
 * Hosted checkout frame (D-035): kicker, H1, and the inline Complete Checkout (its own order summary replaces ours).
 * No (or an empty / no longer Active) session cart goes back to the bag.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'checkout' });
  const { cartId } = await getSession();
  const cart = cartId ? await getMappedCart(cartId, await getMarket()) : null;
  // redirect() throws; it must stay outside any try/catch.
  if (!cart || cart.lines.length === 0) redirect({ href: '/cart', locale });
  return (
    <div className="page py-[calc(var(--space-8)*1.2)] px-(--space-4) tablet:px-(--space-8)">
      <h6 className="text-accent-700">{t('kicker')}</h6>
      <h1 className="mb-(--space-6) text-[52px]">{t('title')}</h1>
      <CheckoutFlow />
    </div>
  );
}
