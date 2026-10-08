import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CartPage } from '@/components/cart/CartPage';

type Params = Promise<{ locale: string }>;

// Patient data: never indexed. (The sign-in prompt for a visitor without a session comes from the (protected) layout.)
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function CartRoute({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CartPage />;
}
