import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { unstable_serialize } from 'swr';
import Header from '@/components/layout/Header';
import PromiseBar from '@/components/layout/PromiseBar';
import ShellProviders from '@/components/layout/ShellProviders';
import { routing } from '@/i18n/routing';
import { keyChannels } from '@/lib/cache-keys';
import { getShellData } from '@/lib/shell-data';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, shell] = await Promise.all([getTranslations('common'), getShellData(locale)]);
  const fallback = {
    [unstable_serialize(keyChannels(shell.country))]: { stores: shell.stores, selectedKey: shell.selectedKey },
  };

  return (
    <ShellProviders fallback={fallback}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-130 focus:rounded-pill focus:bg-ink focus:px-5 focus:py-3 focus:text-surface"
      >
        {t('skipToContent')}
      </a>
      <PromiseBar figures={shell.figures} locale={locale} />
      <Header categories={shell.categories} />
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </ShellProviders>
  );
}
