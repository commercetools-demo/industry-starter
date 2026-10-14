/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CustomerDetail } from '@/components/customers/CustomerDetail';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';
import { titleOf } from '@/lib/portal/page-title';

// Customer detail (workstream V-05): Admin only, the customer is read through the store's own endpoint (another store's id is a 404).
export default async function CustomerRoute({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('customers.view'))) return <Forbidden />;
  const t = await getTranslations('customers');
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={t('title')} />
      <CustomerDetail id={id} />
    </div>
  );
}

export const generateMetadata = titleOf(['nav.items', 'customers']);
