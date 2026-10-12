// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// Client renderer for a published Puck page. All Puck value imports live in client files because the packages create React
// context at module load. The page JSON is fetched on the server (lib/contentools/puck.ts) and passed in as `data`.
import { PuckApiProvider } from '@commercetools-demo/puck-api';
import { PuckDataRenderer } from '@commercetools-demo/puck-renderer';
import type { PuckData } from '@commercetools-demo/puck-types';
import type { ReactNode } from 'react';
import { CONTENTOOLS_PROXY_BASE } from '@/lib/contentools/origin';
import { puckRenderConfig } from './render-config';

export interface ContentoolsPageProps {
  data: PuckData | null;
  storeKey: string;
  projectKey: string;
  locale: string;
  children?: ReactNode;
}

export function ContentoolsPage({ data, storeKey, projectKey, locale, children }: ContentoolsPageProps) {
  if (!data) return <>{children}</>;
  return (
    <div className="puck-page">
      <PuckApiProvider baseURL={CONTENTOOLS_PROXY_BASE} projectKey={projectKey} businessUnitKey={storeKey} locale={locale}>
        <PuckDataRenderer data={data} config={puckRenderConfig} locale={locale} />
      </PuckApiProvider>
    </div>
  );
}
