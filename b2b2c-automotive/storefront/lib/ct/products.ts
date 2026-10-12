// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Card data for a list of product ids (workstream L; K uses it for the popular block). Two calls, never one per card:
// the store's ProductProjection query (`storeProjection`: assortment, tailored text and images, availability) and the standalone
// prices of all skus (D2, D4). Exports for K and M: `getListingProjections`, `getProductSummaries`.
import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { KEY_PATTERN } from '@/lib/ct/in-store';
import { getStandalonePrices } from '@/lib/ct/prices';
import { mapProductSummary, type SummaryContext } from '@/lib/mappers/product-summary';
import type { PriceCandidate, ProductSummary } from '@/lib/types';

export interface ListingProduct {
  projection: ProductProjection;
  /** Every standalone price in scope for the sku; `selectStandalonePrice` (inside `mapProductSummary`) picks one. */
  prices: PriceCandidate[];
}

const PRODUCT_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Store projections (assortment and tailoring of the store) of `ids` in the order of `ids`, each with its standalone prices. A product that is not (or no longer)
 * in the store's assortment or unpublished is skipped. No price arguments are sent: prices are standalone.
 */
export async function getListingProjections(storeKey: string, ids: string[], ctx: SummaryContext): Promise<ListingProduct[]> {
  if (ids.length === 0) return [];
  for (const id of ids) if (!PRODUCT_ID.test(id)) throw new Error('Invalid product id');
  if (!KEY_PATTERN.test(storeKey)) throw new Error('Invalid store key');
  // `storeProjection` applies the store's product selections (assortment) and Product Tailoring (text and images); the SDK has no
  // list call below `in-store/key=...` for projections, this is the query endpoint with the store parameter.
  const { body } = await apiRoot
    .productProjections()
    .get({ queryArgs: { storeProjection: storeKey, where: `id in (${ids.map((i) => `"${i}"`).join(',')})`, localeProjection: [ctx.locale], limit: ids.length } })
    .execute();
  const byId = new Map(body.results.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is ProductProjection => p !== undefined);
  const prices = await getStandalonePrices(
    ordered.map((p) => p.masterVariant.sku).filter((s): s is string => Boolean(s)),
    { currency: ctx.currency, channelIds: [ctx.branchChannelId, ctx.retailChannelId] },
  );
  return ordered.map((projection) => ({ projection, prices: prices.get(projection.masterVariant.sku ?? '') ?? [] }));
}

/** `getListingProjections` mapped to the card model. */
export async function getProductSummaries(storeKey: string, ids: string[], ctx: SummaryContext): Promise<ProductSummary[]> {
  const products = await getListingProjections(storeKey, ids, ctx);
  return products.map(({ projection, prices }) => mapProductSummary(projection, prices, ctx));
}
