// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { DEFAULT_LOCALE_KEY, isAppLocale } from '@/i18n/config';
import { fontClassNames } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = { title: 'Malva' };

// The root layout is the single <html> owner; lang comes from the header the proxy sets (fallback de-DE).
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await headers()).get('x-next-intl-locale');
  return (
    <html lang={isAppLocale(locale) ? locale : DEFAULT_LOCALE_KEY} className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
