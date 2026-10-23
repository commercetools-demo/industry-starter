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

type Props = { params: Promise<{ locale: string }> };

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

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, { ctx, collection, tree, store, figures, featured }] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    loadHomePage(locale),
  ]);

  return (
    <div>
      <JsonLd data={homeStructuredData(locale, t('brand'))} />
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
