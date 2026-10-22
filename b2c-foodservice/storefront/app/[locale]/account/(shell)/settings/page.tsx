import { setRequestLocale } from 'next-intl/server';
import SettingsTab from '@/components/account/SettingsTab';
import { requireCustomerPage } from '@/lib/auth/require-customer';
import { accountMetadata } from '@/lib/auth/account-metadata';

export const dynamic = 'force-dynamic';
export const generateMetadata = accountMetadata('settings');

/** Account, Settings tab: Delete account only (no notification preferences, D-032). */
export default async function AccountSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomerPage('/account/settings');
  return <SettingsTab />;
}
