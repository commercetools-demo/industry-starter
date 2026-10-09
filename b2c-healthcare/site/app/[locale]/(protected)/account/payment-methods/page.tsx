import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountHeading } from '@/components/account/AccountShell';
import { PaymentMethodList } from '@/components/payment-methods/PaymentMethodList';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { listMethods } from '@/lib/ct/payment-methods';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('paymentMethods');
  return pageMetadata({ locale, path: '/account/payment-methods', title: t('metaTitle'), noindex: true });
}

/**
 * `/account/payment-methods`: the customer's saved cards by descriptor only (brand, last four, expiry, default).
 * Read by customer id; a failed or unavailable payment service shows a message, never a broken page.
 */
export default async function PaymentMethodsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account/payment-methods');
  if (!gate.signedIn) return gate.prompt;
  const t = await getTranslations('paymentMethods');
  const methods = await getPaymentProvider()
    .then((provider) => listMethods(gate.customerId, provider))
    .catch(() => null);
  return (
    <>
      <AccountHeading title={t('title')} sub={t('sub')} />
      <PaymentMethodList methods={methods} />
    </>
  );
}
