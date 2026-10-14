/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { StoreTabs } from '@/components/store/StoreTabs';
import { viewerCan } from '@/lib/portal/viewer';

/**
 * Store & channels (workstream U): page header and the four tabs. A role that may not view the store (a Buyer) gets the forbidden
 * view; every action inside is checked again on the server by the seller routes.
 */
export default async function StoreLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('store.view'))) return <Forbidden />;
  const t = await getTranslations('store');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <StoreTabs />
      {children}
    </div>
  );
}
