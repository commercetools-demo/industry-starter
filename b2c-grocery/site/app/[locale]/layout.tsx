import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { User } from 'lucide-react';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { BagButton } from '@/components/layout/BagButton';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ToastProvider } from '@/components/ui/Toast';
import { CartProvider } from '@/context/CartProvider';
import { SWRProvider } from '@/context/SWRProvider';
import { routing } from '@/i18n/routing';
import { getMappedCart } from '@/lib/ct/cart';
import { getValidMarkets } from '@/lib/ct/locale-validation';
import { KEY_CART } from '@/lib/cache-keys';
import { getMarket, getSession } from '@/lib/session';
import type { Cart } from '@/lib/types';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** The session cart for the first paint. A commercetools hiccup must not take the whole site down: fall back to no cart. */
async function loadInitialCart(locale: string): Promise<Cart | null> {
  try {
    const session = await getSession();
    if (!session.cartId) return null;
    const market = await getMarket();
    return await getMappedCart(session.cartId, { ...market, locale });
  } catch {
    return null;
  }
}

// Provider order (binding): NextIntlClientProvider > SWRConfig (J) > ToastProvider (H) > CartProvider (J) > chrome (H) > children.
export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [messages, t, markets, initialCart] = await Promise.all([
    getMessages(),
    getTranslations('nav'),
    getValidMarkets(),
    loadInitialCart(locale),
  ]);
  // Plain link until O fills the account slot.
  const account = (
    <Button href="/account" variant="secondary" size="icon" aria-label={t('account')}>
      <Icon icon={User} size={17} />
    </Button>
  );
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SWRProvider fallback={{ [KEY_CART]: initialCart }}>
        <ToastProvider>
          <CartProvider>
            <AnnouncementBar />
            <Header bag={<BagButton />} account={account} markets={markets} />
            <main className="page-enter">{children}</main>
            <Footer />
          </CartProvider>
        </ToastProvider>
      </SWRProvider>
    </NextIntlClientProvider>
  );
}
