import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { SWRConfig } from 'swr';
import { isSupportedLocale, LOCALES } from '@/lib/utils';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Provider order (binding for later workstreams): NextIntlClientProvider > SWRConfig > ToastProvider (I) > chrome (I) > children.
export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SWRConfig value={{ dedupingInterval: 2000 }}>{children}</SWRConfig>
    </NextIntlClientProvider>
  );
}
