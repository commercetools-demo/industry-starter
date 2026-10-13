import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AddressesTab } from '@/components/company/AddressesTab';
import { COMPANY_TABS, type CompanyTabId } from '@/lib/company/tabs';
import { titleMetadata } from '@/lib/portal/page-title';
import { ProfileTab } from '@/components/company/ProfileTab';
import { UsersTab } from '@/components/company/UsersTab';

// One tab of Company & team (workstream U-09); an unknown tab is a 404. The layout already gated `company.view`.
export default async function CompanyTabPage({ params }: { params: Promise<{ locale: string; tab: string }> }) {
  const { locale, tab } = await params;
  setRequestLocale(locale);
  if (!(COMPANY_TABS as readonly string[]).includes(tab)) notFound();
  switch (tab as CompanyTabId) {
    case 'users':
      return <UsersTab />;
    case 'addresses':
      return <AddressesTab />;
    case 'profile':
      return <ProfileTab />;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tab: string }> }): Promise<Metadata> {
  const { locale, tab } = await params;
  return titleMetadata(locale, ['company.tabs', (COMPANY_TABS as readonly string[]).includes(tab) ? tab : 'users'], ['nav.items', 'company']);
}
