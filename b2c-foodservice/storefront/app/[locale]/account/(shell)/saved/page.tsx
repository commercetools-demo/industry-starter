import { setRequestLocale } from 'next-intl/server';
import SavedTab from '@/components/account/SavedTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';

export const dynamic = 'force-dynamic';

/** Account, Saved tab (server shopping list). */
export default async function AccountSavedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/saved');
  return <SavedTab />;
}
