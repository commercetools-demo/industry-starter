import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { getInventoryDetail } from '@/lib/ct/inventory';
import { cachedPublic } from '@/lib/ct/public-cache';
import { type BundleConfig, mapBundleView, parseBundleConfig } from '@/lib/mappers/preset-bundle';
import type { BundleView } from '@/lib/types';

/** The `bundle-ref` attribute of the bundle product (a key-value-document reference). Workstream V, D5. */
export const BUNDLE_REF_ATTRIBUTE = 'bundle-ref';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICE_EXPANDS = ['masterVariant.price.discounted.discount', 'variants[*].price.discounted.discount'];

export interface BundleReadContext { locale: string; country: string; currency: string }

/** The custom object's value. Needs the `view_key_value_documents` scope (OA-V-a); without it the read fails and the caller shows no bundle. */
async function fetchBundleConfigValue(customObjectId: string): Promise<unknown> {
  const { body } = await apiRoot
    .customObjects()
    .get({ queryArgs: { where: `id="${customObjectId}"`, limit: 1 } })
    .execute();
  return body.results[0]?.value ?? null;
}
const cachedBundleConfigValue = cachedPublic('presetBundleConfig', ['preset-bundle-config'], fetchBundleConfigValue);

/** The config of one custom object id. The id is checked as a UUID before it is used in a predicate. Public data: cached. */
export async function getBundleConfig(customObjectId: string): Promise<BundleConfig | null> {
  if (!UUID.test(customObjectId)) return null;
  return parseBundleConfig(await cachedBundleConfigValue(customObjectId));
}

/** The `bundle-ref` id on the bundle product's master variant, or null. */
export function bundleRefOf(projection: ProductProjection): string | null {
  const value = projection.masterVariant?.attributes?.find((a) => a.name === BUNDLE_REF_ATTRIBUTE)?.value as
    | { id?: unknown }
    | undefined;
  return value && typeof value.id === 'string' ? value.id : null;
}

/**
 * The preset bundle of a product projection for the shopper's market. The component read is not cached (prices and
 * stock depend on the market). One projection read for every component, one inventory read.
 */
export async function getBundleView(
  sku: string, projection: ProductProjection, ctx: BundleReadContext,
): Promise<BundleView | null> {
  const ref = bundleRefOf(projection);
  if (!ref) return null;
  const config = await getBundleConfig(ref);
  if (!config) return null;
  const ids = [...new Set(config.presets.flatMap((p) => [p.machineId, ...p.podIds]))];
  if (ids.length === 0) return mapBundleView(config, new Map(), {}, ctx, sku);

  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        staged: false,
        where: `id in (${ids.map((id) => `"${id}"`).join(', ')})`,
        priceCurrency: ctx.currency,
        priceCountry: ctx.country,
        localeProjection: [ctx.locale],
        expand: PRICE_EXPANDS,
        limit: 50,
      },
    })
    .execute();
  const products = new Map(body.results.map((p) => [p.id, p] as const));
  const skus = body.results.flatMap((p) => [p.masterVariant.sku, ...(p.variants ?? []).map((v) => v.sku)])
    .filter((s): s is string => typeof s === 'string' && s !== '');
  const inventory = skus.length > 0 ? await getInventoryDetail(skus) : {};
  return mapBundleView(config, products, inventory, { locale: ctx.locale, currency: ctx.currency }, sku);
}
