// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Everything one listing page needs, read on the server (workstream L): "All parts", a category and search results share it.
// Flow: parse the address; read store, session, active vehicle and category in parallel; Product Search (ids, facets, total);
// store projections plus standalone prices for the page's ids; fit per card. K and M can reuse the pieces (`searchParts`,
// `getProductSummaries`, `getFitState`); this module is the page assembly, not a shared API.
import 'server-only';
import { cache } from 'react';
import type { AppLocale } from '@/i18n/config';
import { getEnumLabels } from '@/lib/ct/attribute-labels';
import { getCategoryBySlug } from '@/lib/ct/categories';
import { getListingProjections } from '@/lib/ct/products';
import { countAssortment, searchParts } from '@/lib/ct/search';
import { getShellContext } from '@/lib/ct/shell';
import { mapProductSummary } from '@/lib/mappers/product-summary';
import type { ListingCategory, FacetGroup, ProductSummary } from '@/lib/types';
import { buildFacetGroups } from '@/lib/search/facets';
import { getFitState, type FitState } from '@/lib/search/fitment';
import type { ListingScope, SearchContext } from '@/lib/search/build';
import { effectiveSort, hasActiveFilters, PAGE_SIZE, parseListingParams, type ListingParams } from '@/lib/search/params';
import { getSession } from '@/lib/session';
import { getBranchScope } from '@/lib/store/branch-scope';
import { getActiveVehicle } from '@/lib/vehicles/active';
import { COUNTRY_CONFIG } from '@/lib/utils';

export type ListingSurface = { kind: 'all' } | { kind: 'category'; slug: string } | { kind: 'search' };
type RawParams = Record<string, string | string[] | undefined>;

export interface ListingView {
  kind: 'ok';
  surface: ListingSurface['kind'];
  params: ListingParams;
  sort: ReturnType<typeof effectiveSort>;
  category: ListingCategory | null;
  total: number;
  page: number;
  totalPages: number;
  items: { product: ProductSummary; fit: FitState }[];
  groups: FacetGroup[];
  /** City of the selected branch. */
  city?: string;
  shipDays: { min: number; max: number };
  pickupAvailable: boolean;
  /** The fit-only scope is on (a vehicle is active and `fit=0` is absent). */
  fitScopeOn: boolean;
  /** Label of the active vehicle, for the empty-state hint. */
  vehicleLabel?: string;
}
export type ListingResult =
  | ListingView
  | { kind: 'prompt'; params: ListingParams }
  | { kind: 'not-found' }
  | { kind: 'redirect'; page: number; params: ListingParams };

export interface ListingInput {
  storeKey: string;
  locale: AppLocale;
  surface: ListingSurface;
  searchParams: RawParams;
}

const surfaceKey = (s: ListingSurface): string => (s.kind === 'category' ? `category:${s.slug}` : s.kind);
const surfaceOf = (key: string): ListingSurface => (key.startsWith('category:') ? { kind: 'category', slug: key.slice('category:'.length) } : { kind: key as 'all' | 'search' });
const loadOnce = cache((storeKey: string, locale: AppLocale, surface: string, searchKey: string) =>
  loadListing({ storeKey, locale, surface: surfaceOf(surface), searchParams: JSON.parse(searchKey) as RawParams }),
);

/**
 * `loadListing` once per request: the page and its `generateMetadata` both ask, and Product Search runs once
 * (React `cache` keyed by the primitive arguments).
 */
export function getListing(input: ListingInput): Promise<ListingResult> {
  const sorted = Object.fromEntries(Object.entries(input.searchParams).sort(([a], [b]) => (a < b ? -1 : 1)));
  return loadOnce(input.storeKey, input.locale, surfaceKey(input.surface), JSON.stringify(sorted));
}

/** Reads one listing page. `not-found` and `redirect` are decisions for the page component (`notFound()` / `redirect()`). */
export async function loadListing({ storeKey, locale, surface, searchParams }: ListingInput): Promise<ListingResult> {
  const params = parseListingParams(searchParams);
  if (surface.kind === 'search' && !params.q) return { kind: 'prompt', params };

  const [shell, session, vehicle, category] = await Promise.all([
    getShellContext(storeKey, locale),
    getSession(),
    getActiveVehicle(),
    surface.kind === 'category' ? getCategoryBySlug(surface.slug, locale) : Promise.resolve(null),
  ]);
  if (!shell) return { kind: 'not-found' };
  if (surface.kind === 'category' && !category) return { kind: 'not-found' };

  // Prices follow the language of the address: de-DE is EUR and DE, en-US is USD and US (D-042).
  const { currency, country } = COUNTRY_CONFIG[locale];
  const scope = getBranchScope(session, shell.branches, shell.retailChannelId);
  const branch = shell.branches.find((b) => b.key === scope.branchKey);
  const ctx: SearchContext = {
    storeId: shell.storeId,
    locale,
    currency,
    country,
    branchChannelId: scope.branchChannelId,
    retailChannelId: scope.retailChannelId,
    fitKeys: vehicle ? vehicle.fitKeys : null,
  };
  const listingScope: ListingScope = category ? { categoryId: category.id } : {};

  const found = await searchParts(ctx, listingScope, params);
  const totalPages = Math.max(1, Math.ceil(found.total / PAGE_SIZE));
  if (params.page > totalPages) return { kind: 'redirect', page: totalPages, params };

  // A category with nothing of the store in it does not exist for this store; an empty filter result is an empty state.
  if (found.total === 0 && category && !hasActiveFilters(params) && (await countAssortment(ctx, listingScope)) === 0) return { kind: 'not-found' };

  const [products, labels] = await Promise.all([
    getListingProjections(storeKey, found.ids, { locale, currency, country, branchChannelId: scope.branchChannelId, retailChannelId: scope.retailChannelId }),
    getEnumLabels(locale),
  ]);
  const items = products.map(({ projection, prices }) => {
    const product = mapProductSummary(projection, prices, { locale, currency, country, branchChannelId: scope.branchChannelId, retailChannelId: scope.retailChannelId });
    return { product, fit: getFitState(product, vehicle) };
  });

  return {
    kind: 'ok',
    surface: surface.kind,
    params,
    sort: effectiveSort(params),
    category,
    total: found.total,
    page: params.page,
    totalPages,
    items,
    groups: buildFacetGroups(found.facets, params, labels),
    city: branch?.address.city,
    shipDays: shell.settings.shipDays,
    pickupAvailable: shell.branches.length > 0,
    fitScopeOn: vehicle !== null && params.fit,
    vehicleLabel: vehicle?.label,
  };
}
