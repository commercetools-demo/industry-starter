/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { PartnershipPage } from '@/components/partnership/PartnershipPage';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

// Brand partnership (workstream W): the guardrails that still exist and what to fix. Admin only; the route checks again.
export default async function PartnershipRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('partnership.view'))) return <Forbidden />;
  const t = await getTranslations('partnership');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PartnershipPage />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'partnership']);
