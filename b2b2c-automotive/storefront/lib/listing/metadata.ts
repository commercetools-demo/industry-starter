// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `generateMetadata` of the three listing routes (workstream L): title, noindex for search and filtered pages, rel prev/next.
import 'server-only';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { getListing, type ListingInput, type ListingSurface } from '@/lib/listing/load';
import { hasActiveFilters, listingHref as hrefFor, parseListingParams } from '@/lib/search/params';

/** Address of a surface without locale and query. */
export const basePathOf = (store: string, surface: ListingSurface): string =>
  surface.kind === 'category' ? `/${store}/category/${surface.slug}` : surface.kind === 'search' ? `/${store}/search` : `/${store}/parts`;

/** Origin of the request for absolute prev/next links; a Host header that is not a plain host name is ignored. */
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host || !/^[A-Za-z0-9.-]+(:\d+)?$/.test(host)) return null;
  return `${h.get('x-forwarded-proto') === 'https' ? 'https' : 'http'}://${host}`;
}

export async function buildListingMetadata(input: ListingInput): Promise<Metadata> {
  const t = await getTranslations({ locale: input.locale, namespace: 'listing' });
  const params = parseListingParams(input.searchParams);
  const result = await getListing(input);
  const title = input.surface.kind === 'search' ? (params.q ? t('metaTitleSearch', { q: params.q }) : t('searchPromptTitle')) : result.kind === 'ok' && result.category ? result.category.name : t('metaTitleAll');
  const metadata: Metadata = { title };
  if (params.q || hasActiveFilters(params)) metadata.robots = { index: false };

  if (result.kind === 'ok' && result.totalPages > 1) {
    const origin = await requestOrigin();
    if (origin) {
      const base = basePathOf(input.storeKey, input.surface);
      const link = (page: number) => `${origin}/${input.locale}${hrefFor(base, { ...params, page })}`;
      metadata.pagination = { previous: result.page > 1 ? link(result.page - 1) : undefined, next: result.page < result.totalPages ? link(result.page + 1) : undefined };
    }
  }
  return metadata;
}
