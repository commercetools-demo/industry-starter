import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { Hero } from '@/components/home/Hero';
import { PopularAddons } from '@/components/home/PopularAddons';
import { PromoTiles } from '@/components/home/PromoTiles';
import { routing } from '@/i18n/routing';
import { HOME_CONFIG } from '@/lib/config/home';
import { ADDONS_CATEGORY_KEY } from '@/lib/config/listing';
import { marketFromLocale } from '@/lib/config/markets';
import { getOffersInCategory } from '@/lib/ct/catalog';
import { getCategoryTree } from '@/lib/ct/categories';
import { categoryTiles, heroFacts, popularAddons, promoPhone } from '@/lib/home/derive';
import { findCategory } from '@/lib/listing/links';
import type { Locale, Offer } from '@/lib/types';
import { isSupportedLocale } from '@/lib/utils';

// The home page is the same for every visitor: cached catalog reads only, never the session or the cart (those belong to the shell).
// Next needs a literal here; a test asserts it equals CATALOG_TTL.
export const revalidate = 60;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const [t, tree] = await Promise.all([getTranslations({ locale, namespace: 'home.meta' }), getCategoryTree(locale)]);
  const image = findCategory(tree, HOME_CONFIG.hero.categoryKey)?.image;
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}`, languages: { 'en-US': '/en-US', 'de-DE': '/de-DE' } },
    openGraph: { title: t('title'), description: t('description'), ...(image ? { images: [image] } : {}) },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  setRequestLocale(locale);
  const market = marketFromLocale(locale);

  const tree = await getCategoryTree(locale);
  const visibleTop = tree.filter((category) => !HOME_CONFIG.hiddenCategoryKeys.includes(category.key));
  const keys = [...new Set([...visibleTop.map((category) => category.key), HOME_CONFIG.hero.categoryKey, ...HOME_CONFIG.promoTiles.map((tile) => tile.categoryKey)])];
  const entries = await Promise.all(keys.map(async (key): Promise<[string, Offer[]]> => [key, await getOffersInCategory(key, market)]));
  const offersByCategory = Object.fromEntries(entries);

  const addonOffers = offersByCategory[ADDONS_CATEGORY_KEY] ?? [];
  const addons = popularAddons(addonOffers, HOME_CONFIG.popularAddonOfferKeys, HOME_CONFIG.popularAddonCount);
  const phoneKey = HOME_CONFIG.promoTiles.find((tile) => tile.id === 'phone')?.categoryKey ?? '';

  return (
    <div className="flex flex-col gap-7 pt-7 pb-7">
      <Hero locale={locale} tree={tree} facts={heroFacts(offersByCategory[HOME_CONFIG.hero.categoryKey] ?? [])} />
      <PromoTiles locale={locale} tree={tree} phonePrice={promoPhone(offersByCategory[phoneKey] ?? []).price} addonNames={addons.map((addon) => addon.name)} />
      <CategoryTiles locale={locale} tiles={categoryTiles(tree, offersByCategory, HOME_CONFIG.hiddenCategoryKeys)} />
      <PopularAddons locale={locale} tree={tree} addons={addons} />
    </div>
  );
}
