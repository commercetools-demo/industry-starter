// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { DEFAULT_LOCALE_KEY, isAppLocale } from '@/i18n/config';
import { getStoreTheme } from '@/lib/contentools/theme';
import { fontClassNames } from '@/lib/fonts';
import { buildThemeCss } from '@/lib/theme/adapter';
import './globals.css';

export const metadata: Metadata = { title: 'Malva' };

// The root layout is the single <html> owner; lang comes from the header the proxy sets (fallback de-DE).
// The store theme is applied at first paint: the adapter output (empty for the default theme) goes into a style element
// in <head>. Its selector (:root:root) outranks tokens.css, so the order of the stylesheets does not matter.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get('x-next-intl-locale');
  const themeCss = buildThemeCss(await getStoreTheme(requestHeaders.get('x-store-key')));
  return (
    <html lang={isAppLocale(locale) ? locale : DEFAULT_LOCALE_KEY} className={fontClassNames}>
      <head>
        <style id="store-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
