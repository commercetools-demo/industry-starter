// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MalvaShell } from '@/components/malva/MalvaShell';
import { isAppLocale } from '@/i18n/config';
import { getMalvaNavCategories } from '@/lib/ct/malva-catalog';
import type { NavCategory } from '@/lib/types';

/**
 * Layout of the Malva level pages (`/{locale}` and `/{locale}/categories/...`). Not the reseller layout: no utility bar, store chip,
 * cart, garage or impersonation banner, and no store theme, so the default theme tokens apply. The header, footer and finder drawer
 * live in `MalvaShell`.
 */
export default async function MalvaLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  // A category outage leaves the navigation empty; the page still renders.
  const categories = await getMalvaNavCategories(locale).catch((): NavCategory[] => {
    console.error('[malva-layout] categories could not be read');
    return [];
  });
  return (
    <MalvaShell locale={locale} categories={categories}>
      {children}
    </MalvaShell>
  );
}
