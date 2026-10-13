// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Everything one Malva listing page needs (change add-malva-home): the category by slug and one page of the whole catalog.
// No store, branch, cart or price is read; the active vehicle is read only for the fit scope.
import 'server-only';
import { cache } from 'react';
import type { AppLocale } from '@/i18n/config';
import { getCategoryBySlug } from '@/lib/ct/categories';
import { searchMalvaProducts } from '@/lib/ct/malva-catalog';
import type { MalvaListingResult } from '@/lib/malva-types';
import { parseListingParams, type ListingParams } from '@/lib/search/params';
import type { ListingCategory } from '@/lib/types';
import { getActiveVehicle } from '@/lib/vehicles/active';

type RawParams = Record<string, string | string[] | undefined>;

export type MalvaListingView =
  | { kind: 'not-found' }
  /** The page is past the last one: the caller redirects to `page`. */
  | { kind: 'redirect'; page: number; params: ListingParams }
  | { kind: 'ok'; category: ListingCategory; params: ListingParams; result: MalvaListingResult; vehicleLabel?: string; fitScopeOn: boolean };

export interface MalvaListingInput {
  locale: AppLocale;
  slug: string;
  searchParams: RawParams;
}

/** Reads one listing page. An unknown slug is `not-found`; a failing search throws (the route's `error.tsx` answers). */
export async function loadMalvaListing({ locale, slug, searchParams }: MalvaListingInput): Promise<MalvaListingView> {
  const params = parseListingParams(searchParams);
  const [category, vehicle] = await Promise.all([getCategoryBySlug(slug, locale), getActiveVehicle()]);
  if (!category) return { kind: 'not-found' };

  const result = await searchMalvaProducts({ locale, params, categoryId: category.id, fitKeys: vehicle ? vehicle.fitKeys : null });
  if (params.page > result.totalPages) return { kind: 'redirect', page: result.totalPages, params };
  return { kind: 'ok', category, params, result, vehicleLabel: vehicle?.label, fitScopeOn: vehicle !== null && params.fit };
}

const loadOnce = cache((locale: AppLocale, slug: string, searchKey: string) => loadMalvaListing({ locale, slug, searchParams: JSON.parse(searchKey) as RawParams }));

/** `loadMalvaListing` once per request (the page and its `generateMetadata` both ask). */
export function getMalvaListing(input: MalvaListingInput): Promise<MalvaListingView> {
  const sorted = Object.fromEntries(Object.entries(input.searchParams).sort(([a], [b]) => (a < b ? -1 : 1)));
  return loadOnce(input.locale, input.slug, JSON.stringify(sorted));
}
