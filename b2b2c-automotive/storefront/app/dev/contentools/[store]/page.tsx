// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContentoolsPage } from '@/components/contentools/ContentoolsPage';
import { getProjectKey } from '@/lib/contentools/project-key';
import { getPublishedPage, HOME_SLUG } from '@/lib/contentools/puck';

export const metadata: Metadata = { title: 'Contentools page (dev)', robots: { index: false } };

// Dev-only: renders a store's published home page, or the fallback when it has none.
export default async function ContentoolsDev({ params }: { params: Promise<{ store: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { store } = await params;
  const data = await getPublishedPage(store, HOME_SLUG);
  return (
    <ContentoolsPage data={data} storeKey={store} projectKey={getProjectKey()} locale="en-US">
      <p data-testid="no-page">No published page</p>
    </ContentoolsPage>
  );
}
