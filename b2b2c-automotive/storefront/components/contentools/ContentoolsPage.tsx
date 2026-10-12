// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// Client renderer for a published Puck page. All Puck value imports live in client files because the packages create React
// context at module load. The page JSON is fetched on the server (lib/contentools/puck.ts) and passed in as `data`.
// Rendering mode (workstream K, D10): server rendered by Next (see plans/evidence/K/render-mode.md).
import { PuckApiProvider } from '@commercetools-demo/puck-api';
import { PuckDataRenderer } from '@commercetools-demo/puck-renderer';
import type { PuckConfig, PuckData } from '@commercetools-demo/puck-types';
import type { ReactNode } from 'react';
import { HomeDataProvider } from '@/components/home/HomeDataContext';
import { CONTENTOOLS_PROXY_BASE } from '@/lib/contentools/origin';
import type { HomeData } from '@/lib/home/types';
import { puckRenderConfig } from './render-config';

export interface ContentoolsPageProps {
  data: PuckData | null;
  storeKey: string;
  projectKey: string;
  locale: string;
  /** Block set; defaults to the storefront's render config (default blocks plus the automotive blocks). */
  config?: PuckConfig;
  /** Server-read data for the automotive blocks (HomeDataContext); also provided to the fallback `children`. */
  homeData?: HomeData;
  children?: ReactNode;
}

export function ContentoolsPage({ data, storeKey, projectKey, locale, config = puckRenderConfig, homeData, children }: ContentoolsPageProps) {
  const content = data ? (
    <div className="puck-page">
      <PuckApiProvider baseURL={CONTENTOOLS_PROXY_BASE} projectKey={projectKey} businessUnitKey={storeKey} locale={locale}>
        <PuckDataRenderer data={data} config={config} locale={locale} />
      </PuckApiProvider>
    </div>
  ) : (
    <>{children}</>
  );
  return homeData ? <HomeDataProvider value={homeData}>{content}</HomeDataProvider> : content;
}
