import type { Metadata } from 'next';
import { siteUrl } from '@/lib/seo';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { preconnect } from 'react-dom';
import type { ReactNode } from 'react';
import { OrganizationJsonLd } from '@/components/layout/OrganizationJsonLd';
import { Footer } from '@/components/layout/Footer';
import { Nav } from '@/components/layout/Nav';
import { SwrProvider } from '@/components/layout/SwrProvider';
import { TopBar } from '@/components/layout/TopBar';
import { PortalDialogProvider } from '@/context/portal-dialog';
import { routing } from '@/i18n/routing';
import './../globals.css';
import './../shell.css';

/** Resolves relative metadata URLs (social images) against the public origin, never the request host. */
export function generateMetadata(): Metadata {
  return { metadataBase: new URL(siteUrl()) };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// This layout must not read the session or cookies (D20): every page below stays cacheable.
/** Photos come from one host; opening the connection early saves a round trip before the first image. */
const IMAGE_ORIGIN = 'https://images.pexels.com';

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  preconnect(IMAGE_ORIGIN);
  const t = await getTranslations('chrome');
  return (
    <html lang={locale}>
      <body>
        <OrganizationJsonLd />
        <a className="skip" href="#content">{t('skipToContent')}</a>
        <NextIntlClientProvider>
          <SwrProvider>
            <PortalDialogProvider>
              <TopBar />
              <Nav />
              <main id="content" tabIndex={-1}>{children}</main>
              <Footer />
            </PortalDialogProvider>
          </SwrProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
