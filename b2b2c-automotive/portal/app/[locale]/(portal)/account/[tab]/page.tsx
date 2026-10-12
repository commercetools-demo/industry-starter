import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ACCOUNT_TABS, type AccountTabId } from '@/lib/company/tabs';
import { AddressesTab } from '@/components/account/AddressesTab';
import { BusinessUnitsTab } from '@/components/account/BusinessUnitsTab';
import { GeneralTab } from '@/components/account/GeneralTab';
import { SecurityTab } from '@/components/account/SecurityTab';

// One tab of Account settings (workstream U-10); an unknown tab is a 404. The layout already gated `account.view`.
export default async function AccountTabPage({ params }: { params: Promise<{ locale: string; tab: string }> }) {
  const { locale, tab } = await params;
  setRequestLocale(locale);
  if (!(ACCOUNT_TABS as readonly string[]).includes(tab)) notFound();
  switch (tab as AccountTabId) {
    case 'general':
      return <GeneralTab />;
    case 'security':
      return <SecurityTab />;
    case 'addresses':
      return <AddressesTab />;
    case 'business-units':
      return <BusinessUnitsTab />;
  }
}
