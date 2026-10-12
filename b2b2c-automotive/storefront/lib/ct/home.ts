// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Everything the home page reads on the server (workstream K): store name, branch and pickup promise, category tiles, the
// popular products and the active vehicle. Read once per request; the blocks get it through HomeDataContext (no client fetch).
import 'server-only';
import { cache } from 'react';
import type { AppLocale } from '@/i18n/config';
import { getNavCategories } from '@/lib/ct/categories';
import { getListingProjections } from '@/lib/ct/products';
import { searchParts } from '@/lib/ct/search';
import { getShellContext } from '@/lib/ct/shell';
import type { HomeData } from '@/lib/home/types';
import { mapProductSummary } from '@/lib/mappers/product-summary';
import type { SearchContext } from '@/lib/search/build';
import { getFitState } from '@/lib/search/fitment';
import { parseListingParams } from '@/lib/search/params';
import { getSession } from '@/lib/session';
import { getBranchScope } from '@/lib/store/branch-scope';
import { getPickupOption } from '@/lib/store/pickup';
import type { Vehicle } from '@/lib/types';
import { getActiveVehicle, type ActiveVehicle } from '@/lib/vehicles/active';
import { COUNTRY_CONFIG } from '@/lib/utils';

export const POPULAR_FETCH_COUNT = 8;

/**
 * The store's most popular products (seeded `popularity-rank`, ascending, unranked last; sort `popular` of the listing). With an
 * active vehicle only fitting products are searched (fit-only, same expression as the listing). Prices are the standalone prices
 * of the branch channel, the retail channel, then the Malva base price (resolved by `getListingProjections`/`mapProductSummary`).
 */
export async function getPopularProducts(storeKey: string, ctx: SearchContext, vehicle: Vehicle | null, count: number): Promise<HomeData['popular']> {
  const found = await searchParts(ctx, {}, parseListingParams({}));
  const ids = found.ids.slice(0, count);
  const summaryCtx = { locale: ctx.locale, currency: ctx.currency, country: ctx.country, branchChannelId: ctx.branchChannelId, retailChannelId: ctx.retailChannelId };
  const products = await getListingProjections(storeKey, ids, summaryCtx);
  return products.map(({ projection, prices }) => {
    const product = mapProductSummary(projection, prices, summaryCtx);
    return { product, fit: getFitState(product, vehicle) };
  });
}

const toVehicle = (v: ActiveVehicle | null): Vehicle | null => (v ? { id: v.id, make: v.make, model: v.model, year: v.year, engine: v.engine, label: v.label } : null);

async function loadHomeData(storeKey: string, locale: AppLocale, withPopular: boolean): Promise<HomeData | null> {
  const [shell, session, active] = await Promise.all([getShellContext(storeKey, locale), getSession(), getActiveVehicle()]);
  if (!shell) return null;
  const { currency, country } = COUNTRY_CONFIG[locale];
  const scope = getBranchScope(session, shell.branches, shell.retailChannelId);
  const branch = shell.branches.find((b) => b.key === scope.branchKey) ?? null;
  const vehicle = toVehicle(active);
  const ctx: SearchContext = { storeId: shell.storeId, locale, currency, country, branchChannelId: scope.branchChannelId, retailChannelId: scope.retailChannelId, fitKeys: active ? active.fitKeys : null };

  const [categories, popular] = await Promise.all([
    getNavCategories(shell.storeId, locale),
    withPopular
      ? getPopularProducts(storeKey, ctx, vehicle, POPULAR_FETCH_COUNT).catch(() => {
          console.error('[home] popular products could not be read');
          return [] as HomeData['popular'];
        })
      : Promise.resolve([] as HomeData['popular']),
  ]);

  return {
    storeKey,
    storeName: shell.settings.name,
    branch: branch ? { city: branch.address.city, name: branch.name } : null,
    pickup: branch ? getPickupOption(branch, new Date(), shell.settings.timezone) : 'ship-to-store',
    shipDays: shell.settings.shipDays,
    categories,
    popular,
    vehicle,
  };
}

const loadOnce = cache(loadHomeData);

/** `null` for an unknown store. `popular: false` skips the product search (a published page without the popular block). */
export function getHomeData({ storeKey, locale }: { storeKey: string; locale: AppLocale }, options: { popular?: boolean } = {}): Promise<HomeData | null> {
  return loadOnce(storeKey, locale, options.popular !== false);
}
