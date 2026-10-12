'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Loads the Leaflet map in the browser only (Leaflet touches `window` on import).
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

function MapLoading() {
  const t = useTranslations('store.map');
  return (
    <div role="status" className="flex h-full min-h-6400 w-full items-center justify-center rounded-300 bg-bg-surface-subdued text-body-2 font-semibold text-text-subdued">
      {t('loading')}
    </div>
  );
}

export const LazyBranchMap = dynamic(() => import('./BranchMap'), { ssr: false, loading: () => <MapLoading /> });
