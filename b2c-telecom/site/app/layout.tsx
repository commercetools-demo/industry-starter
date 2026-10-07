import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { fontVariables } from './fonts';
import './globals.css';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
