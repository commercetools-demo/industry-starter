import 'server-only';
import { cache } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { loadListing, type ListingResult } from '@/lib/listing/load';
import { activeFilterCount, listingHref, type ListingScope } from '@/lib/search/params';

type SP = Record<string, string | string[] | undefined>;

/** Per-request memo (primitive arguments, so React `cache` can key it): the page and `generateMetadata` share one load. */
const loadOnce = cache((locale: string, scope: ListingScope, slug: string, spKey: string): Promise<ListingResult> =>
  loadListing({ locale, scope, slug: slug || undefined, searchParams: JSON.parse(spKey) as SP }),
);

export function getListing(locale: string, scope: ListingScope, slug: string | undefined, searchParams: SP): Promise<ListingResult> {
  const sorted = Object.fromEntries(Object.entries(searchParams).sort(([a], [b]) => (a < b ? -1 : 1)));
  return loadOnce(locale, scope, slug ?? '', JSON.stringify(sorted));
}

/** Title, noindex for search and filtered URLs, and rel prev/next. */
export async function listingMetadata(locale: string, result: ListingResult): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'plp' });
  if (result.kind === 'prompt') return { title: t('breadcrumb.search'), robots: { index: false } };
  if (result.kind !== 'ok') return {};
  const { scope, params } = result;
  const title =
    scope === 'category' ? (result.category?.name ?? '') : scope === 'search' ? t('title.search', { query: params.q ?? '' }) : t('title.all');
  const url = (page: number) => `/${locale}${listingHref(result.basePath, { ...params, page }, scope)}`;
  return {
    title,
    robots: params.q || activeFilterCount(params) > 0 ? { index: false } : undefined,
    pagination: {
      ...(result.page > 1 ? { previous: url(result.page - 1) } : {}),
      ...(result.page < result.pageCount ? { next: url(result.page + 1) } : {}),
    },
  };
}
