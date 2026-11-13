import DrinksHome from '@/components/home/DrinksHome';
import { BRANDS, brandOf } from '@/lib/brands';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import CategoryTiles from '@/components/home/CategoryTiles';
import CollectionBanner from '@/components/home/CollectionBanner';
import EditorialStrip from '@/components/home/EditorialStrip';
import Hero from '@/components/home/Hero';
import { ProductSectionSkeleton } from '@/components/home/HomeSkeletons';
import { BestsellersSection, NewArrivalsSection, SubscribeSection } from '@/components/home/HomeSections';
import JsonLd from '@/components/content/JsonLd';
import { HOME_CONTENT } from '@/content/home';
import { pageMetadata } from '@/lib/content/seo';
import { loadHomePage } from '@/lib/home-page';
import { homeStructuredData } from '@/lib/home-seo';
import { routing } from '@/i18n/routing';
import InstoreHome from '@/components/instore/InstoreHome';
import { isInstore } from '@/lib/app-mode';

type Props = { params: Promise<{ brand?: string; locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand, locale } = await params;
  if (isInstore()) {
    const t = await getTranslations({ locale, namespace: 'instore' });
    return { title: t('meta.title'), robots: { index: false, follow: false } };
  }
  const t = await getTranslations({ locale, namespace: BRANDS[brandOf(brand).slug].home === 'drinks' ? 'home.drinks.meta' : 'home.meta' });
  const meta = pageMetadata({
    brand: brandOf(brand).slug, locale,
    path: '',
    title: t('title'),
    description: t('description'),
    ownLocales: [...routing.locales],
    ...(HOME_CONTENT.hero.imageUrl ? { openGraph: { images: [HOME_CONTENT.hero.imageUrl] } } : {}),
  });
  const languages = { ...(meta.alternates?.languages ?? {}), 'x-default': `/${brandOf(brand).slug}/en-US` };
  return { ...meta, alternates: { ...meta.alternates, languages } };
}

export default async function HomePage({ params }: Props) {
  const { brand, locale } = await params;
  setRequestLocale(locale);
  if (isInstore()) {
    const { loadInstoreHome } = await import('@/lib/instore/category');
    return <InstoreHome tree={await loadInstoreHome(locale)} />;
  }
  const [t, { ctx, collection, tree, store, figures, featured }] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    loadHomePage(locale, brandOf(brand).slug),
  ]);

  // The brand picks the home variant (registry); everything below is the Malva Coffee home.
  if (BRANDS[brandOf(brand).slug].home === 'drinks') {
    return (
      <>
        <JsonLd data={homeStructuredData(locale, BRANDS['malva-drinks'].name, 'malva-drinks')} />
        <DrinksHome locale={locale} figures={figures} tree={tree} ctx={ctx} />
      </>
    );
  }

  return (
    <div>
      <JsonLd data={homeStructuredData(locale, t('brand'), brandOf(brand).slug)} />
      <Hero locale={locale} figures={figures} featured={featured} collection={collection} />
      <CategoryTiles tree={tree} />
      {collection ? <CollectionBanner store={store} /> : null}
      <Suspense fallback={<ProductSectionSkeleton />}>
        <BestsellersSection ctx={ctx} tree={tree} store={store} />
      </Suspense>
      <EditorialStrip locale={locale} />
      <Suspense fallback={<ProductSectionSkeleton />}>
        <NewArrivalsSection ctx={ctx} tree={tree} store={store} />
      </Suspense>
      <Suspense fallback={null}>
        <SubscribeSection ctx={ctx} />
      </Suspense>
    </div>
  );
}
