// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingPage } from '@/components/listing/ListingPage';
import { isAppLocale } from '@/i18n/config';
import { buildListingMetadata } from '@/lib/listing/metadata';

type Props = {
  params: Promise<{ locale: string; store: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, store, slug } = await params;
  if (!isAppLocale(locale)) return {};
  return buildListingMetadata({ storeKey: store, locale, surface: { kind: 'category', slug }, searchParams: await searchParams });
}

/** A category of the store's assortment with its whole subtree (workstream L). Unknown or empty categories answer 404. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, store, slug } = await params;
  if (!isAppLocale(locale)) notFound();
  return <ListingPage locale={locale} store={store} surface={{ kind: 'category', slug }} searchParams={await searchParams} />;
}
