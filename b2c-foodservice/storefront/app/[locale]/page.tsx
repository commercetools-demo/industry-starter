import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import CategoryTiles from '@/components/home/CategoryTiles';
import CollectionBanner from '@/components/home/CollectionBanner';
import EditorialStrip from '@/components/home/EditorialStrip';
import Hero from '@/components/home/Hero';
import { renderPage } from '@/components/page-builder/renderPage';
import { ProductSectionSkeleton } from '@/components/home/HomeSkeletons';
import { BestsellersSection, NewArrivalsSection, SubscribeSection } from '@/components/home/HomeSections';
import JsonLd from '@/components/content/JsonLd';
import { HOME_CONTENT } from '@/content/home';
import { pageMetadata } from '@/lib/content/seo';
import { loadHomePage } from '@/lib/home-page';
import { homeStructuredData } from '@/lib/home-seo';
import { routing } from '@/i18n/routing';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  const meta = pageMetadata({
    locale,
    path: '',
    title: t('title'),
    description: t('description'),
    ownLocales: [...routing.locales],
    ...(HOME_CONTENT.hero.imageUrl ? { openGraph: { images: [HOME_CONTENT.hero.imageUrl] } } : {}),
  });
  const languages = { ...(meta.alternates?.languages ?? {}), 'x-default': '/en-US' };
  return { ...meta, alternates: { ...meta.alternates, languages } };
}

/** The code-built home. Shown while no home page is published, and when the page builder is down. */
async function nativeHome(locale: string) {
  const { ctx, collection, tree, store, figures, featured } = await loadHomePage(locale);
  return (
    <>
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
    </>
  );
}

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, outcome] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    renderPage({ locale, ...(searchParams ? { searchParams: await searchParams } : {}) }),
  ]);

  return (
    <div>
      <JsonLd data={homeStructuredData(locale, t('brand'))} />
      {outcome.kind === 'page' ? outcome.node : await nativeHome(locale)}
    </div>
  );
}
