/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import { BranchesPanel } from '@/components/store/BranchesPanel';
import { SettingsForm } from '@/components/store/SettingsForm';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Settings": identity, location and branches (workstream U-05). The default branch time zone is the store's German market.
const DEFAULT_BRANCH_TIMEZONE = 'Europe/Berlin';

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="flex flex-col gap-400">
      <SettingsForm />
      <BranchesPanel timezone={DEFAULT_BRANCH_TIMEZONE} />
    </div>
  );
}

export const generateMetadata = titleOf(['store.tabs', 'settings'], ['nav.items', 'store']);
