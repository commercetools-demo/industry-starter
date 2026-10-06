import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ShoppingBag, User } from 'lucide-react';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ToastProvider } from '@/components/ui/Toast';
import { routing } from '@/i18n/routing';
import { COUNTRY_CONFIG } from '@/lib/utils';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Provider order (binding): NextIntlClientProvider > SWRConfig (J) > ToastProvider (H) > CartProvider (J) > chrome (H) > children.
export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [messages, t] = await Promise.all([getMessages(), getTranslations('nav')]);
  // Plain links until J (BagButton with count) and O (account menu) fill the slots. G-08 switches `markets` to getValidMarkets().
  const bag = (
    <Button href="/cart" className="flex-none gap-2 whitespace-nowrap">
      <Icon icon={ShoppingBag} size={16} />
      {t('bag')}
    </Button>
  );
  const account = (
    <Button href="/account" variant="secondary" size="icon" aria-label={t('account')}>
      <Icon icon={User} size={17} />
    </Button>
  );
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ToastProvider>
        <AnnouncementBar />
        <Header bag={bag} account={account} markets={Object.values(COUNTRY_CONFIG)} />
        <main className="page-enter">{children}</main>
        <Footer />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
