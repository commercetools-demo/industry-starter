// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProductPage } from '@/components/product/ProductPage';
import { isAppLocale } from '@/i18n/config';
import { getProductPage } from '@/lib/product/load';
import { buildProductMetadata } from '@/lib/product/metadata';
import { requestOrigin } from '@/lib/product/origin';

type Props = {
  params: Promise<{ locale: string; store: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const skuOf = (raw: string | string[] | undefined): string | undefined => (typeof raw === 'string' && raw.length <= 64 ? raw : undefined);

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, store, slug } = await params;
  if (!isAppLocale(locale)) return {};
  const view = await getProductPage({ storeKey: store, locale, slug, sku: skuOf((await searchParams).sku) });
  if (view.kind !== 'ok') return {};
  const t = await getTranslations({ locale, namespace: 'pdp' });
  return buildProductMetadata(view.product, t('metaFallbackDescription', { name: view.product.name }), { origin: await requestOrigin(), locale, store });
}

/** A part of the store's assortment (workstream M). Unknown slugs and parts withdrawn from the store answer 404. Dynamic: price, stock and fit follow the session. */
export default async function Page({ params, searchParams }: Props) {
  const { locale, store, slug } = await params;
  if (!isAppLocale(locale)) notFound();
  return <ProductPage locale={locale} store={store} slug={slug} sku={skuOf((await searchParams).sku)} />;
}
