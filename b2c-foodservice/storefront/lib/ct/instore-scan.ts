import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { VariantTranslator } from '@/lib/cart/summary';
import { mapScanProduct } from '@/lib/mappers/scan-product';
import { loadProductPage } from '@/lib/pdp/load';
import type { ScanProduct } from '@/lib/types';

/**
 * The product a scanned SKU leads to (workstream R, D-045). One call into the product page loader (Product Search by exact SKU,
 * the projection, the inventory), so the price and the stock are the ones the product page and the bag use; nothing is cached
 * here beyond that loader's per-request memo. A SKU typed in lower case is tried again in upper case (the catalogue's SKUs are
 * upper case and the search is exact). Null: the shop does not sell this code.
 */
export async function getScanProduct(sku: string, locale: string): Promise<ScanProduct | null> {
  const t = await getTranslations({ locale, namespace: 'cart' });
  const translate = ((key: string, values: Record<string, string | number>) => t(key as 'variant.grams', values)) as VariantTranslator;
  const candidates = sku === sku.toUpperCase() ? [sku] : [sku, sku.toUpperCase()];
  for (const candidate of candidates) {
    const page = await loadProductPage(candidate, locale);
    const found = page ? mapScanProduct(page, candidate, translate) : null;
    if (found) return found;
  }
  return null;
}
