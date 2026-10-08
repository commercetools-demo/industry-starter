import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutPage } from '@/components/checkout/CheckoutPage';

type Params = Promise<{ locale: string }>;

// Patient data: never indexed. (The sign-in prompt "Sign in to check out." for a visitor without a session comes
// from the (protected) layout, which never renders this page for them.)
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function CheckoutRoute({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CheckoutPage />;
}
