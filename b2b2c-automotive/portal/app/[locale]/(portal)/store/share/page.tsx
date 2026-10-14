/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { setRequestLocale } from 'next-intl/server';
import { SharePanel } from '@/components/store/SharePanel';
import { storefrontOrigin } from '@/lib/portal/storefront-origin';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Share": attributed links with QR codes (workstream U-05). The origin is read on the server and passed as a prop.
export default async function SharePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SharePanel origin={storefrontOrigin()} />;
}

export const generateMetadata = titleOf(['store.tabs', 'share'], ['nav.items', 'store']);
