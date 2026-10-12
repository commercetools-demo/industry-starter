// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { PuckData } from '@commercetools-demo/puck-types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentoolsPage } from '@/components/contentools/ContentoolsPage';
import { DefaultHome } from '@/components/home/DefaultHome';
import { isAppLocale } from '@/i18n/config';
import { getHomeData } from '@/lib/ct/home';
import { getPublishedPage, HOME_SLUG } from '@/lib/contentools/puck';
import { getProjectKey } from '@/lib/contentools/project-key';

type Params = Promise<{ locale: string; store: string }>;

/** The published home page, or null: no page, or Contentools failed (the shopper gets the default layout either way). */
async function readHomePage(store: string): Promise<PuckData | null> {
  try {
    return await getPublishedPage(store, HOME_SLUG);
  } catch {
    console.warn('[home] Contentools home page could not be read; rendering the default layout');
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) return {};
  const [home, t] = await Promise.all([getHomeData({ storeKey: store, locale }), getTranslations({ locale, namespace: 'home' })]);
  if (!home) return {};
  const city = home.branch?.city;
  return {
    // `absolute`: the store layout's title template would repeat the store name.
    title: { absolute: t('metaTitle', { reseller: home.storeName }) },
    description: city ? t('metaDescription', { reseller: home.storeName, city }) : t('metaDescriptionNoCity', { reseller: home.storeName }),
  };
}

/**
 * Home of a reseller store (workstream K): the published Contentools `/home` page with the automotive blocks, else the default
 * layout. Server rendered; everything the blocks show is read here once (HomeDataContext). Dynamic: the page reads the session
 * (branch) and the garage (vehicle).
 */
export default async function StoreHome({ params }: { params: Params }) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const [home, page] = await Promise.all([getHomeData({ storeKey: store, locale }), readHomePage(store)]);
  if (!home) notFound();
  // A published page without a hero would leave the page without a heading: add a visually hidden one.
  const hasHero = page?.content?.some((block) => (block as { type?: string }).type === 'AutomotiveHero') ?? false;

  return (
    <>
      {page && !hasHero ? <h1 className="sr-only">{home.storeName}</h1> : null}
      <ContentoolsPage data={page} homeData={home} storeKey={store} projectKey={getProjectKey()} locale={locale}>
        {page ? null : <DefaultHome />}
      </ContentoolsPage>
    </>
  );
}
