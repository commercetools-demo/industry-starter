/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CatalogTabs } from '@/components/catalog/CatalogTabs';
import { ChainCard } from '@/components/catalog/ChainCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';

/**
 * Catalog & pricing (workstream T): page header, the authority chain, the six tabs. A role that may not view the catalog gets the
 * forbidden view; the actions inside are checked again on the server by every seller route.
 */
export default async function CatalogLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('catalog.view'))) return <Forbidden />;
  const t = await getTranslations('catalog');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ChainCard />
      <CatalogTabs />
      {children}
    </div>
  );
}
