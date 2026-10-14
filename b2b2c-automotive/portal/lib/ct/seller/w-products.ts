// Product reads shared by bundles, local products and the brand partnership page (W): the store's own products of a product type,
// read as staged projections (unpublished products included) and filtered by the attribute `owner-store`. Another store's
// product is never returned. Product Search would filter on the attribute server side; this reads the type's projections in pages
// (capped at 2,000 products) because the attribute is not part of a projection predicate.
import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { wRoot } from './w-root';

export const PRODUCT_READ_CAP = 2000;

export function attributeValue(p: Pick<ProductProjection, 'masterVariant'>, name: string): unknown {
  const value = p.masterVariant.attributes?.find((a) => a.name === name)?.value as unknown;
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { key?: unknown }).key === 'string') return (value as { key: string }).key;
  return value;
}

export const textAttribute = (p: Pick<ProductProjection, 'masterVariant'>, name: string): string | undefined => {
  const value = attributeValue(p, name);
  return typeof value === 'string' ? value : undefined;
};

export const textSetAttribute = (p: Pick<ProductProjection, 'masterVariant'>, name: string): string[] => {
  const value = attributeValue(p, name);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
};

/** Staged projections of the product type whose `owner-store` is the store. */
export async function listOwnProducts(typeKey: string, storeKey: string): Promise<ProductProjection[]> {
  const root = await wRoot();
  const type = (await root.productTypes().withKey({ key: typeKey }).get().execute()).body;
  const out: ProductProjection[] = [];
  for (let offset = 0; offset < PRODUCT_READ_CAP; offset += 100) {
    const { body } = await root.productProjections().get({ queryArgs: { where: 'productType(id=:t)', 'var.t': type.id, staged: true, limit: 100, offset } }).execute();
    out.push(...body.results.filter((p) => textAttribute(p, 'owner-store') === storeKey));
    if (body.results.length < 100) break;
  }
  return out;
}

/** True when any product of the project uses the SKU (published or not). The caller never says whose it is. */
export async function skuExists(sku: string): Promise<boolean> {
  return (await existingSkus([sku])).has(sku);
}

/** Which of the SKUs are used in the project (staged projections, 100 per call). */
export async function existingSkus(skus: readonly string[]): Promise<Set<string>> {
  const root = await wRoot();
  const found = new Set<string>();
  const unique = [...new Set(skus)];
  for (let i = 0; i < unique.length; i += 100) {
    const part = unique.slice(i, i + 100);
    const { body } = await root.productProjections().get({ queryArgs: { where: 'masterVariant(sku in :skus)', 'var.skus': part, staged: true, limit: 100 } }).execute();
    for (const p of body.results) if (p.masterVariant.sku) found.add(p.masterVariant.sku);
  }
  return found;
}

/** Keys of products that exist in the project, among the given keys. */
export async function existingKeys(keys: readonly string[]): Promise<Set<string>> {
  const root = await wRoot();
  const found = new Set<string>();
  const unique = [...new Set(keys)];
  for (let i = 0; i < unique.length; i += 100) {
    const part = unique.slice(i, i + 100);
    const { body } = await root.productProjections().get({ queryArgs: { where: 'key in :keys', 'var.keys': part, staged: true, limit: 100 } }).execute();
    for (const p of body.results) if (p.key) found.add(p.key);
  }
  return found;
}
