// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReactNode } from 'react';
import { FinderDrawerProvider } from '@/components/malva/FinderDrawerProvider';
import { MalvaFooter } from '@/components/malva/MalvaFooter';
import { MalvaHeader } from '@/components/malva/MalvaHeader';
import type { NavCategory } from '@/lib/types';

/**
 * Frame of every Malva page: the header with the category navigation, the page, the footer, and the finder drawer host (the drawer opens
 * from the header button and from a product card). The layout reads the categories (components never import `lib/ct`).
 */
export function MalvaShell({ locale, categories, children }: { locale: string; categories: NavCategory[]; children: ReactNode }) {
  return (
    <FinderDrawerProvider locale={locale}>
      <div className="flex min-h-screen flex-col bg-surface-page">
        <MalvaHeader categories={categories} />
        <div className="flex-1">{children}</div>
        <MalvaFooter />
      </div>
    </FinderDrawerProvider>
  );
}
