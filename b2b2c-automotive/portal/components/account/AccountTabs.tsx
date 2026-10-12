'use client';

import { useTranslations } from 'next-intl';
import { RouteTabs } from '@/components/portal/RouteTabs';
import { ACCOUNT_TABS } from '@/lib/company/tabs';

/** The four tabs of Account settings. */
export function AccountTabs() {
  const t = useTranslations('account.tabs');
  return <RouteTabs ariaLabel={t('label')} tabs={ACCOUNT_TABS.map((id) => ({ id, href: `/account/${id}`, label: t(id === 'business-units' ? 'businessUnits' : id) }))} />;
}
