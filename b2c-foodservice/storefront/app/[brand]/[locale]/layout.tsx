import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
// The demo gate lives outside the locale tree, so this redirect must not be locale-prefixed.
// eslint-disable-next-line no-restricted-imports
import { redirect } from 'next/navigation';
import { unstable_serialize } from 'swr';
import AssistantRoot from '@/components/assistant/AssistantRoot';
import CartDrawer from '@/components/cart/CartDrawer';
import InstoreShell from '@/components/instore/InstoreShell';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import PromiseBar from '@/components/layout/PromiseBar';
import ShellProviders from '@/components/layout/ShellProviders';
import LocaleChooser from '@/components/locale/LocaleChooser';
import StorePicker from '@/components/store/StorePicker';
import BrandSwitcher from '@/components/layout/BrandSwitcher';
import { routing } from '@/i18n/routing';
import { BRAND_SLUGS, brandOf, isBrandSlug } from '@/lib/brands';
import { isInstore } from '@/lib/app-mode';
import { keyChannels } from '@/lib/cache-keys';
import { isDemoGateOpen } from '@/lib/gate';
import { getShellData } from '@/lib/shell-data';

export function generateStaticParams() {
  return BRAND_SLUGS.flatMap((brand) => routing.locales.map((locale) => ({ brand, locale })));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ brand: string; locale: string }>;
}>) {
  const { brand: brandParam, locale } = await params;
  if (!isBrandSlug(brandParam) || !hasLocale(routing.locales, locale)) notFound();
  const brand = brandOf(brandParam);
  setRequestLocale(locale);
  if (!(await isDemoGateOpen())) redirect('/gate');

  // The In-store companion (workstream R, D-041) has its own frame and reads no shell data (categories, stores, figures).
  if (isInstore()) return <InstoreShell>{children}</InstoreShell>;

  const [t, shell] = await Promise.all([getTranslations('common'), getShellData(locale, brand.slug)]);
  const fallback = {
    [unstable_serialize(keyChannels(shell.country))]: { stores: shell.stores, selectedKey: shell.selectedKey },
  };

  return (
    <ShellProviders fallback={fallback}>
      <AssistantRoot enabled={process.env.ASSISTANT_ENABLED?.trim().toLowerCase() === 'true'}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-130 focus:rounded-pill focus:bg-ink focus:px-5 focus:py-3 focus:text-surface"
        >
          {t('skipToContent')}
        </a>
        <BrandSwitcher />
        <PromiseBar figures={shell.figures} locale={locale} />
        <Header categories={shell.categories} brand={brand} />
        <main id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer categories={shell.categories} brand={brand} />
        {/* Dialogs sit outside the header's stacking context so no page layer can cover them. */}
        {brand.pickup ? <StorePicker /> : null}
        <CartDrawer />
        <LocaleChooser markets={shell.markets} />
      </AssistantRoot>
    </ShellProviders>
  );
}
