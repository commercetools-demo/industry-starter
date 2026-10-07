import { Suspense, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { SWRConfig } from 'swr';
import { BundlePill } from '@/components/layout/BundlePill';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ToastProvider } from '@/components/ui/Toast';
import { isSupportedLocale, LOCALES } from '@/lib/utils';
import { AccountSlot } from './_shell/AccountSlot';
import { loadNavItems } from './_shell/loadNavItems';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Provider order (binding for later workstreams): NextIntlClientProvider > SWRConfig > ToastProvider > [M: CartProvider] > chrome > children.
// AccountSlot reads the session cookie, which makes every page dynamic: accepted, the frame must never come from shared cached content.
export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const [messages, t, items] = await Promise.all([getMessages(), getTranslations('shell'), loadNavItems(locale)]);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 2000 }}>
        <ToastProvider>
          {/* M inserts <CartProvider> here, wrapping everything below. */}
          <div className="flex min-h-screen flex-col">
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-20 focus:rounded-pill focus:bg-brand-950 focus:px-6 focus:py-3 focus:font-display focus:text-sm focus:font-semibold focus:text-text-on-pink"
            >
              {t('skipToContent')}
            </a>
            <SiteHeader
              items={items}
              account={
                <Suspense fallback={<Skeleton className="h-5 w-20" />}>
                  <AccountSlot />
                </Suspense>
              }
              bundle={<BundlePill count={0} />}
            />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter items={items} />
          </div>
        </ToastProvider>
      </SWRConfig>
    </NextIntlClientProvider>
  );
}
