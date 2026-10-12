'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The two tabs of Content (workstream U-08, decision 6): Pages and Content blocks. There is no Media tab.
import { useTranslations } from 'next-intl';
import { RouteTabs } from '@/components/portal/RouteTabs';

export function ContentTabs() {
  const t = useTranslations('content.tabs');
  return (
    <RouteTabs
      ariaLabel={t('label')}
      tabs={[
        { id: 'pages', href: '/content/pages', label: t('pages') },
        { id: 'blocks', href: '/content/blocks', label: t('blocks') },
      ]}
    />
  );
}
