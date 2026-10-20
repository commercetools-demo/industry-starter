/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { IntakeForm } from '@/components/portal/IntakeForm';
import { IntakeList } from '@/components/portal/IntakeList';

export const metadata: Metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'portal.intake' });
  return (
    <div style={{ display: 'grid', gap: 40 }}>
      <div>
        <h1 style={{ marginBottom: 8 }}>{t('title')}</h1>
        <p>{t('intro')}</p>
      </div>
      <IntakeForm />
      <IntakeList />
    </div>
  );
}
