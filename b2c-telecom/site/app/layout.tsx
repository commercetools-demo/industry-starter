/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { SITE_URL } from '@/lib/config/site';
import { fontVariables } from './fonts';
import './globals.css';

// Absolute base for canonical and hreflang links (Lighthouse SEO: they must be absolute URLs).
export const metadata: Metadata = { metadataBase: new URL(SITE_URL) };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
