// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { MalvaListing } from '@/components/malva/MalvaListing';
import { isAppLocale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getMalvaListing } from '@/lib/listing/malva-load';
import { hasActiveFilters, listingHref } from '@/lib/search/params';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Title of the category; a filtered page is noindex. Unknown slugs and unsupported locales get no metadata (the page answers 404). */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isAppLocale(locale)) return {};
  const view = await getMalvaListing({ locale, slug, searchParams: await searchParams });
  if (view.kind !== 'ok') return {};
  return { title: view.category.name, ...(hasActiveFilters(view.params) ? { robots: { index: false } } : {}) };
}

/** A category of the whole catalog at Malva level. An unknown slug answers 404. */
export default async function MalvaCategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const view = await getMalvaListing({ locale, slug, searchParams: await searchParams });
  if (view.kind === 'not-found') notFound();
  if (view.kind === 'redirect') redirect({ href: listingHref(`/categories/${slug}`, { ...view.params, page: view.page }), locale });
  if (view.kind !== 'ok') return null;
  return <MalvaListing view={view} slug={slug} />;
}
