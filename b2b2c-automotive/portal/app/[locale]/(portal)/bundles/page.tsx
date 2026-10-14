/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BundlesPage } from '@/components/bundles/BundlesPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

// Bundles (workstream W): the server checks the role; every write is checked again by the seller routes.
export default async function BundlesRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('bundles.manage'))) return <Forbidden />;
  const [tn, t] = await Promise.all([getTranslations('nav.items'), getTranslations('bundles')]);
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={tn('bundles')} subtitle={t('subtitle')} />
      <BundlesPage />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'bundles']);
