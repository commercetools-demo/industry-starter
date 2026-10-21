import 'server-only';
import { cache } from 'react';
import { getAttributeLabels } from '@/lib/ct/attribute-labels';
import { getCategoryTree } from '@/lib/ct/categories';
import { getInventoryDetail } from '@/lib/ct/inventory';
import { getProductBySku, getRecurrencePolicies } from '@/lib/ct/product-detail';
import { getFreeShippingThreshold } from '@/lib/ct/shipping';
import { mapProductDetail } from '@/lib/mappers/product-detail';
import { RETURN_DAYS } from '@/lib/shop-config';
import type { Category, InventoryDetail, Money, ProductDetail, RecurrencePolicyView } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

export interface ProductPageData {
  product: ProductDetail;
  /** Recurrence policies (empty when the product is not subscribable or the read failed: the Subscribe card is hidden). */
  policies: RecurrencePolicyView[];
  /** The inventory read failed: the page says stock could not be checked and disables the add button. */
  inventoryFailed: boolean;
  freeShippingThreshold: Money | null;
  returnDays: number;
  /** Collection in store is offered in this market (US only, D-035). */
  collection: boolean;
  country: string;
  currency: string;
}

const logFailure = (event: string) => (e: unknown) => {
  console.error(JSON.stringify({ event, status: (e as { statusCode?: number })?.statusCode }));
};

async function load(sku: string, locale: string): Promise<ProductPageData | null> {
  const market = marketForLocale(locale);
  const ctx = { locale, country: market.country, currency: market.currency };
  const projection = await getProductBySku(sku, ctx);
  if (!projection) return null;

  const skus = [projection.masterVariant, ...projection.variants].map((v) => v.sku).filter((s): s is string => Boolean(s));
  const [labels, tree, inventory, policies, threshold] = await Promise.all([
    getAttributeLabels(locale).catch((e: unknown) => {
      logFailure('pdp_labels_failed')(e);
      return {};
    }),
    getCategoryTree(locale).catch((e: unknown) => {
      logFailure('pdp_categories_failed')(e);
      return [] as Category[];
    }),
    getInventoryDetail(skus).catch((e: unknown): null => {
      logFailure('pdp_inventory_failed')(e);
      return null;
    }),
    getRecurrencePolicies(locale).catch((e: unknown): null => {
      logFailure('pdp_policies_failed')(e);
      return null;
    }),
    getFreeShippingThreshold(market.country, market.currency).catch((e: unknown): null => {
      logFailure('pdp_threshold_failed')(e);
      return null;
    }),
  ]);

  const product = mapProductDetail(projection, {
    ...ctx,
    labels,
    tree,
    inventory: inventory ?? ({} as Record<string, InventoryDetail>),
    policyIds: policies ? new Set(policies.map((p) => p.id)) : null,
  });
  return {
    product,
    policies: product.subscribable && product.shape !== 'machine' ? (policies ?? []) : [],
    inventoryFailed: inventory === null,
    freeShippingThreshold: threshold,
    returnDays: RETURN_DAYS,
    collection: market.collection,
    country: market.country,
    currency: market.currency,
  };
}

/**
 * Everything the product page needs for one SKU and locale, or null when the SKU is unknown (the page then answers 404).
 * Wrapped in React `cache()` so `generateMetadata` and the page share one load with the same locale, currency and
 * country (skill rule: matching context). Exported for K, M, N and O.
 */
export const loadProductPage: (sku: string, locale: string) => Promise<ProductPageData | null> = cache(load);
