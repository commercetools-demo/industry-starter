/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AccountTabs } from '@/components/account/AccountTabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';

/** Account settings (workstream U-10): header and the four tabs. Every signed-in role may open it. */
export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('account.view'))) return <Forbidden />;
  const t = await getTranslations('account');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <AccountTabs />
      {children}
    </div>
  );
}
