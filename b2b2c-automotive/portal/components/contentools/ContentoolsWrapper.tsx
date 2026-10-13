'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Mounts one Contentools manager through the portal's same-origin proxy (workstream U-03, decisions 2 and 4). The browser
// never gets the Contentools JWT: `jwtToken` is a marker, the proxy drops it and attaches the server-held token on writes.
// Each manager mounts its own router with `basename = parentUrl`, so the Next route that renders this must be a catch-all.
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { CONTENTOOLS_PROXY_BASE } from '@/lib/contentools/origin';
import { PLACEHOLDER_TOKEN } from './placeholder';
import { portalPuckConfig } from './puck-config';

export type ContentoolsTab = 'pages' | 'items' | 'theme';

const MOUNT_DELAY_MS = 500;

const Spinner = () => {
  const t = useTranslations('contentools');
  return (
    <p role="status" className="p-600 text-body-2 font-semibold text-gray-15">
      {t('loading')}
    </p>
  );
};

const PageManager = dynamic(() => import('@commercetools-demo/puck-page-manager').then((m) => m.PageManager), { ssr: false, loading: () => <Spinner /> });
const ContentManager = dynamic(() => import('@commercetools-demo/puck-content-manager').then((m) => m.ContentManager), { ssr: false, loading: () => <Spinner /> });
const ThemeManager = dynamic(() => import('@commercetools-demo/puck-theme-manager').then((m) => m.ThemeManager), { ssr: false, loading: () => <Spinner /> });

export interface ContentoolsWrapperProps {
  tab: ContentoolsTab;
  /** Router basename of the manager, for example `/de-DE/store/theme`. */
  parentUrl: string;
  locale: string;
  storeKey: string | null;
  connected: boolean;
  /** The commercetools project key (the Contentools tenant). Not a secret; the proxy injects it anyway. */
  projectKey: string;
}

export function ContentoolsWrapper({ tab, parentUrl, locale, storeKey, connected, projectKey }: ContentoolsWrapperProps) {
  const t = useTranslations('contentools');
  const [baseURL, setBaseURL] = useState<string | null>(null);

  useEffect(() => {
    if (!storeKey || !connected) return;
    // The managers need an absolute baseURL and measure the DOM on mount: wait a beat, as the reference wrapper does.
    const timer = setTimeout(() => setBaseURL(`${window.location.origin}${CONTENTOOLS_PROXY_BASE}`), MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [storeKey, connected]);

  if (!storeKey) return <p className="p-600 text-body-1 font-semibold text-gray-15">{t('pickStore')}</p>;
  if (!connected) {
    return (
      <p role="alert" className="m-400 rounded-300 bg-bg-warning-subdued p-400 text-body-2 font-semibold text-gray-15">
        {t('notConnected')}
      </p>
    );
  }
  if (!baseURL) return <Spinner />;

  const common = { projectKey, jwtToken: PLACEHOLDER_TOKEN, baseURL, businessUnitKey: storeKey, locale };
  if (tab === 'theme') return <ThemeManager {...common} />;
  if (tab === 'items') return <ContentManager {...common} parentUrl={parentUrl} config={portalPuckConfig} />;
  return <PageManager {...common} parentUrl={parentUrl} config={portalPuckConfig} />;
}
