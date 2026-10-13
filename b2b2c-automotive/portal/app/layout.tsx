import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { DEFAULT_LOCALE_KEY, isAppLocale } from '@/i18n/config';
import { fontClassNames } from '@/lib/fonts';
import { themeInitScript } from '@/lib/theme-init';
import './globals.css';

// Every route sets its own title (lib/portal/page-title.ts); the template appends the product name.
export const metadata: Metadata = { title: { default: 'Malva Partner Portal', template: '%s | Malva Partner Portal' } };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await headers()).get('x-next-intl-locale');
  return (
    <html lang={isAppLocale(locale) ? locale : DEFAULT_LOCALE_KEY} data-theme="light" className={fontClassNames} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
