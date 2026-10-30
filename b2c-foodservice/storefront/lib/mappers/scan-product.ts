import { availabilityState } from '@/lib/availability';
import { variantSummary, type VariantTranslator } from '@/lib/cart/summary';
import { maxQuantity, minQuantity } from '@/lib/product/add-state';
import { effectiveUnitPrice } from '@/lib/product/price';
import { LOW_STOCK_THRESHOLD, PDP_MAX_QUANTITY } from '@/lib/shop-config';
import type { ProductPageData, ScanProduct, VariantAttrValue } from '@/lib/types';

/**
 * The scanner dialog's view of one SKU (workstream R, D-044). Pure. Built from the product page data (`loadProductPage`), so the
 * price, the stock and the variant labels are the ones the product page and the bag use. Returns null when the SKU is not one of
 * the product's variants (a search hit on another field must never show the wrong variant).
 */
export function mapScanProduct(page: ProductPageData, sku: string, t: VariantTranslator): ScanProduct | null {
  const { product } = page;
  const variant = product.variants.find((v) => v.sku === sku);
  if (!variant) return null;

  // The facts that identify a variant to a shopper but live on the product (intensity, roast) join the variant's own attributes.
  const attrs: Record<string, VariantAttrValue> = { ...variant.attrs };
  if (product.facts.intensity !== undefined) attrs.intensity = product.facts.intensity;
  const summary = variantSummary(product.shape, attrs, variant.attrLabels, t);

  const quantity = page.inventoryFailed ? 0 : variant.stock.online;
  const price = variant.price
    ? {
        amount: effectiveUnitPrice(variant.price, 1),
        ...(variant.price.discounted ? { old: variant.price.value } : {}),
      }
    : null;
  const min = minQuantity(variant);
  return {
    sku: variant.sku,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: variant.images[0]?.url ?? product.variants.find((v) => v.images[0])?.images[0]?.url ?? null,
    variant: summary,
    price,
    availability: { state: availabilityState(quantity, LOW_STOCK_THRESHOLD), quantity },
    inventoryFailed: page.inventoryFailed,
    minQuantity: min,
    maxQuantity: Math.max(min, maxQuantity(variant, 'delivery', undefined, PDP_MAX_QUANTITY)),
    href: `/p/${encodeURIComponent(product.slug)}/${encodeURIComponent(variant.sku)}`,
  };
}
