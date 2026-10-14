/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { RouteTabs } from '@/components/portal/RouteTabs';
import { COMPANY_TABS } from '@/lib/company/tabs';

/** The three tabs of Company & team (no Cost centres tab, Q-V01). */
export function CompanyTabs() {
  const t = useTranslations('company.tabs');
  return <RouteTabs ariaLabel={t('label')} tabs={COMPANY_TABS.map((id) => ({ id, href: `/company/${id}`, label: t(id) }))} />;
}
