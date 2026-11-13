import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { BRANDS, BRAND_SLUGS, DEFAULT_BRAND, type BrandSlug } from '@/lib/brands';

async function fetchSelectionId(brand: BrandSlug): Promise<string> {
  try {
    const { body } = await apiRoot.productSelections().withKey({ key: BRANDS[brand].productSelectionKey }).get().execute();
    return body.id;
  } catch (e) {
    if ((e as { statusCode?: number })?.statusCode === 404) return '';
    throw e;
  }
}

/**
 * The id of a brand's product selection (Product Search filters by id), '' when the selection does not exist in the project.
 * Public and stable: cached 5 minutes (tag `product-selections`).
 */
export const getSelectionId: (brand: BrandSlug) => Promise<string> = cachedPublic('productSelections', ['selection-id'], fetchSelectionId);

/**
 * True when the product is assigned to the brand's product selection. A product page of another brand is a 404. A brand whose
 * selection is missing from the project owns nothing, except the default brand, which owns everything (a project seeded before
 * multibrand keeps working). Not cached: one small read per product page.
 */
export async function isInBrandSelection(productId: string, brand: BrandSlug): Promise<boolean> {
  const selectionId = await getSelectionId(brand);
  if (!selectionId) return brand === DEFAULT_BRAND;
  const { body } = await apiRoot.products().withId({ ID: productId }).productSelections().get({ queryArgs: { limit: 100 } }).execute();
  return body.results.some((a) => a.productSelection.id === selectionId);
}

/**
 * The brand a product belongs to: the brand whose product selection it is assigned to. The server decides this (a cart line's brand is
 * never taken from the client). A product in no brand selection (a project seeded before multibrand) is the default brand.
 */
export async function getProductBrand(productId: string): Promise<BrandSlug> {
  const selections = await Promise.all(BRAND_SLUGS.map(async (brand) => [brand, await getSelectionId(brand)] as const));
  const { body } = await apiRoot.products().withId({ ID: productId }).productSelections().get({ queryArgs: { limit: 100 } }).execute();
  const assigned = new Set(body.results.map((a) => a.productSelection.id));
  return selections.find(([, id]) => id && assigned.has(id))?.[0] ?? DEFAULT_BRAND;
}
