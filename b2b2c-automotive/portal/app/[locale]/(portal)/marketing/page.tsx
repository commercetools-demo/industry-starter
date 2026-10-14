/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MarketingPage } from '@/components/marketing/MarketingPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

// Marketing (workstream W): Malva co-op campaigns. A role that may not manage marketing gets the forbidden view; every route checks again.
export default async function MarketingRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('marketing.manage'))) return <Forbidden />;
  const t = await getTranslations('marketing');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <MarketingPage />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'marketing']);
