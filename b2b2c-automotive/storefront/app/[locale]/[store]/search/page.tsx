// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingPage } from '@/components/listing/ListingPage';
import { isAppLocale } from '@/i18n/config';
import { buildListingMetadata } from '@/lib/listing/metadata';

type Props = {
  params: Promise<{ locale: string; store: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) return {};
  return buildListingMetadata({ storeKey: store, locale, surface: { kind: 'search' }, searchParams: await searchParams });
}

/** Search results (`?q=`): the same listing with the query in the title. An empty query shows a prompt and runs no search. */
export default async function SearchPage({ params, searchParams }: Props) {
  const { locale, store } = await params;
  if (!isAppLocale(locale)) notFound();
  return <ListingPage locale={locale} store={store} surface={{ kind: 'search' }} searchParams={await searchParams} />;
}
