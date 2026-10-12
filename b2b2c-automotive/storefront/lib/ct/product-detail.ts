// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Reads of the product page (workstream M): the store's projection by slug (assortment, tailored text and images, stock), the
// untailored master projection (locked data), the standalone prices of the sku, and the related parts.
//   const detail = await getProductBySlug(storeKey, slug, ctx, sku?)   // null: not in the store's assortment -> notFound()
//   const related = await getRelatedSummaries(storeKey, detail, ctx, { storeId, fitKeys })
import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { cache } from 'react';
import { apiRoot } from '@/lib/ct/client';
import { KEY_PATTERN } from '@/lib/ct/in-store';
import { getStandalonePrices } from '@/lib/ct/prices';
import { getListingProjections } from '@/lib/ct/products';
import { searchParts } from '@/lib/ct/search';
import { mapProductDetail, type DetailContext } from '@/lib/mappers/product-detail';
import { mapProductSummary } from '@/lib/mappers/product-summary';
import type { ProductDetail, ProductSummary } from '@/lib/types';

const SLUG_MAX = 256;
const SKU = /^[A-Za-z0-9._-]{1,64}$/;

/** A value inside a predicate string literal: backslash and double quote are escaped (predicate injection). */
export const escapePredicate = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const masterOf = cache(async (id: string, locale: string): Promise<ProductProjection> => {
  const { body } = await apiRoot.productProjections().withId({ ID: id }).get({ queryArgs: { localeProjection: [locale] } }).execute();
  return body;
});

/**
 * The product page model, or `null` when the slug is unknown, too long, or the product is not (or no longer) in the store's
 * assortment. Step 1 is the store projection (no price arguments: prices are standalone); step 2 reads the master projection and
 * the standalone prices of the chosen sku in parallel. `sku` (the `?sku=` parameter) picks a variant of a multi-variant product.
 */
export async function getProductBySlug(storeKey: string, slug: string, ctx: DetailContext, sku?: string): Promise<ProductDetail | null> {
  if (!KEY_PATTERN.test(storeKey) || slug.length === 0 || slug.length > SLUG_MAX) return null;
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        storeProjection: storeKey,
        where: `slug(${ctx.locale}="${escapePredicate(slug)}")`,
        localeProjection: [ctx.locale],
        expand: ['categories[*]', 'categories[*].ancestors[*]'],
        limit: 1,
      },
    })
    .execute();
  const tailored = body.results[0];
  if (!tailored) return null;
  const variantSkus = [tailored.masterVariant, ...(tailored.variants ?? [])].map((v) => v.sku).filter((s): s is string => Boolean(s));
  const chosen = sku && variantSkus.includes(sku) ? sku : (tailored.masterVariant.sku ?? '');
  const [master, prices] = await Promise.all([
    masterOf(tailored.id, ctx.locale),
    chosen && SKU.test(chosen) ? getStandalonePrices([chosen], { currency: ctx.currency, channelIds: [ctx.branchChannelId, ctx.retailChannelId] }) : Promise.resolve(new Map()),
  ]);
  return mapProductDetail({ tailored, master }, prices.get(chosen) ?? [], ctx, chosen);
}

const RELATED_LIMIT = 4;

/**
 * "Often bought together": the master's `related-skus` when it has some (a sku outside the store's assortment is dropped by the
 * store projection), else the best sellers of the product's deepest category (fit-only with a vehicle), never the product itself.
 */
export async function getRelatedSummaries(
  storeKey: string,
  product: ProductDetail,
  ctx: DetailContext,
  scope: { storeId: string; fitKeys: string[] | null },
): Promise<ProductSummary[]> {
  const skus = product.relatedSkus.filter((s) => SKU.test(s) && s !== product.sku).slice(0, 6);
  if (skus.length > 0) {
    const { body } = await apiRoot
      .productProjections()
      .get({ queryArgs: { storeProjection: storeKey, where: `masterVariant(sku in (${skus.map((s) => `"${s}"`).join(',')}))`, localeProjection: [ctx.locale], limit: skus.length } })
      .execute();
    const bySku = new Map(body.results.map((p) => [p.masterVariant.sku ?? '', p]));
    const ordered = skus.map((s) => bySku.get(s)).filter((p): p is ProductProjection => p !== undefined).slice(0, RELATED_LIMIT);
    if (ordered.length === 0) return [];
    const prices = await getStandalonePrices(
      ordered.map((p) => p.masterVariant.sku).filter((s): s is string => Boolean(s)),
      { currency: ctx.currency, channelIds: [ctx.branchChannelId, ctx.retailChannelId] },
    );
    return ordered.map((p) => mapProductSummary(p, prices.get(p.masterVariant.sku ?? '') ?? [], ctx));
  }

  const category = product.categoryTrail[product.categoryTrail.length - 1];
  if (!category) return [];
  const found = await searchParts(
    { storeId: scope.storeId, locale: ctx.locale, currency: ctx.currency, country: ctx.country, branchChannelId: ctx.branchChannelId, retailChannelId: ctx.retailChannelId, fitKeys: scope.fitKeys },
    { categoryId: category.id },
    { sort: 'popular', sortGiven: false, page: 1, fit: true, brand: [], pickup: false, attrs: {}, q: undefined },
  );
  const ids = found.ids.filter((id) => id !== product.id).slice(0, RELATED_LIMIT);
  const listed = await getListingProjections(storeKey, ids, ctx);
  return listed.map(({ projection, prices }) => mapProductSummary(projection, prices, ctx));
}
