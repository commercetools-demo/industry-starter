import { setRequestLocale } from 'next-intl/server';
import SubscriptionsTab from '@/components/account/subscriptions/SubscriptionsTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';
import { accountMetadata } from '@/lib/auth/account-metadata';

export const dynamic = 'force-dynamic';
export const generateMetadata = accountMetadata('subscriptions');

/** Subscriptions tab (workstream N). The guard and the shell are L's; the cards read `/api/recurring-orders` in the browser. */
export default async function AccountSubscriptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/subscriptions');
  return <SubscriptionsTab />;
}
