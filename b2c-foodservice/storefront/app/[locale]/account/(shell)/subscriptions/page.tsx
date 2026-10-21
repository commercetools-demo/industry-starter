import { setRequestLocale } from 'next-intl/server';
import SubscriptionsTab from '@/components/account/subscriptions/SubscriptionsTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';

export const dynamic = 'force-dynamic';

/** Subscriptions tab (workstream N). The guard and the shell are L's; the cards read `/api/recurring-orders` in the browser. */
export default async function AccountSubscriptionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/subscriptions');
  return <SubscriptionsTab />;
}
