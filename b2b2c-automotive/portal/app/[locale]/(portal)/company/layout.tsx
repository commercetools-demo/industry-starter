/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CompanyTabs } from '@/components/company/CompanyTabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';

/** Company & team (workstream U-09): header and the three tabs. Every role may view; writes are Admin only (checked again on the server). */
export default async function CompanyLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('company.view'))) return <Forbidden />;
  const t = await getTranslations('company');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CompanyTabs />
      {children}
    </div>
  );
}
