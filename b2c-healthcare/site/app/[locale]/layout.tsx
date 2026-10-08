import { hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SwrProvider } from '@/components/providers/SwrProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { IntlProvider } from '@/i18n/IntlProvider';
import { routing } from '@/i18n/routing';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import { getHeaderUser } from '@/lib/header-user';
import { showJournal } from '@/lib/routes';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// <html lang> is set in app/layout.tsx (the only root layout) from the active locale; this layout
// validates the segment, provides the catalog and renders the shell. The shell reads the session on
// every request (cart count and identity), so pages below it are dynamic by design. Pages must not
// render their own <main>: the layout provides `#main`.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [messages, user, t] = await Promise.all([getMessages(), getHeaderUser(), getTranslations('common')]);
  return (
    <IntlProvider locale={locale} messages={messages}>
      {/* Adds the display name to the id-only user of the root fallback; `null` marks an anonymous visitor so useAccount does not call /api/auth/me on first paint. */}
      <SwrProvider fallback={{ [KEY_ACCOUNT]: user }}>
        <ToastProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-navy-900"
          >
            {t('skipToContent')}
          </a>
          <Header hasArticles={showJournal(locale)} />
          <main id="main" className="min-h-[60vh] pb-20">
            {children}
          </main>
          <Footer />
        </ToastProvider>
      </SwrProvider>
    </IntlProvider>
  );
}
