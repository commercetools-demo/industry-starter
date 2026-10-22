import { setRequestLocale } from 'next-intl/server';
import PaymentMethodsTab from '@/components/account/PaymentMethodsTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';
import { accountMetadata } from '@/lib/auth/account-metadata';

export const dynamic = 'force-dynamic';
export const generateMetadata = accountMetadata('payments');

/** Account, Payment methods tab (cards are saved by the hosted Checkout; no add form here). */
export default async function AccountPaymentMethodsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/payment-methods');
  return <PaymentMethodsTab />;
}
