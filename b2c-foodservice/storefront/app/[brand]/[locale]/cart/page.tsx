import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import CartPage from '@/components/cart/CartPage';
import { loadCart } from '@/lib/cart/load';

/** The bag is per person and changes on every write: rendered per request, never cached, never indexed. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart.page' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * `/[locale]/cart`. The server reads the bag once (`loadCart`) and passes it as `initialCart`, so the page paints with its
 * lines and no spinner; the client then keeps it fresh. When the read fails the client tries again and shows its own error
 * with a Retry button.
 */
export default async function CartRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const initialCart = await loadCart(locale);
  return <CartPage {...(initialCart === undefined ? {} : { initialCart })} />;
}
