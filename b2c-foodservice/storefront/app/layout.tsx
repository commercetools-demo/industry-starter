import type { Metadata, Viewport } from 'next';
import { Archivo, Roboto, Roboto_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { TrackerScripts } from '@ct-demos/demotools/tracker';
import { isInstore } from '@/lib/app-mode';
import { MANIFEST_COLOURS } from '@/lib/instore/manifest';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-roboto-mono',
  display: 'swap',
});

/**
 * In-store companion (workstream R): the page covers the whole screen of a phone (`viewport-fit=cover`, the safe-area insets are in
 * app/instore.css), the browser chrome takes the brand colour, and a pinch zoom stays possible (accessibility). The website keeps
 * the framework default.
 */
export function generateViewport(): Viewport {
  return isInstore() ? { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: MANIFEST_COLOURS.theme } : {};
}

/** In-store: never indexed (also sent as `X-Robots-Tag` and in robots.txt), installable to the home screen, no auto phone-number links. */
export function generateMetadata(): Metadata {
  if (!isInstore()) return {};
  return {
    robots: { index: false, follow: false },
    manifest: '/instore.webmanifest',
    appleWebApp: { capable: true, title: 'Malva In-store', statusBarStyle: 'default' },
    formatDetection: { telephone: false },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${archivo.variable} ${roboto.variable} ${robotoMono.variable}`}>
      <head>
        <TrackerScripts gate={false} />
      </head>
      <body className="bg-canvas text-ink font-body">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
