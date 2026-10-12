// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isAppLocale } from '@/i18n/config';
import { getProductPage } from '@/lib/product/load';

/**
 * Decides "does this part exist in this store" ABOVE the `loading.tsx` boundary. A `notFound()` inside the page would be thrown after
 * the skeleton was streamed (status 200, a soft 404); thrown here nothing has been sent yet, so an unknown slug or a part withdrawn
 * from the store answers a real HTTP 404, while client navigations still show the skeleton. The read is shared with the page (React cache).
 */
export default async function ProductLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string; store: string; slug: string }> }) {
  const { locale, store, slug } = await params;
  if (!isAppLocale(locale)) notFound();
  const view = await getProductPage({ storeKey: store, locale, slug });
  if (view.kind !== 'ok') notFound();
  return children;
}
