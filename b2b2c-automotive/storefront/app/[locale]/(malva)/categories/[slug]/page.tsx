// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getMalvaListing } from '@/lib/listing/malva-load';
import { listingHref } from '@/lib/search/params';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** A category of the whole catalog at Malva level. An unknown slug answers 404. The page body is a placeholder (components 4.5). */
export default async function MalvaCategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const view = await getMalvaListing({ locale, slug, searchParams: await searchParams });
  if (view.kind === 'not-found') notFound();
  if (view.kind === 'redirect') redirect({ href: listingHref(`/categories/${slug}`, { ...view.params, page: view.page }), locale });
  if (view.kind !== 'ok') return null;
  return (
    <main className="mx-auto max-w-content p-5 text-text">
      <h1 className="font-display text-3xl text-text-strong">{view.category.name}</h1>
      <p className="font-ui text-sm text-text-muted">{view.result.total}</p>
    </main>
  );
}
