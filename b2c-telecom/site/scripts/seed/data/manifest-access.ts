// Small readers over the manifest, shared by the seed tests and the verify checks.
import { MANIFEST } from '.';
import type { PriceDraft, ProductDraft, VariantDraft } from '../types';

export const PRODUCTS = MANIFEST.product as ProductDraft[];
export const OFFERS = PRODUCTS.filter((p) => p.productType === 'malva-offer');
export const DESCRIPTIVE = PRODUCTS.filter((p) => p.productType !== 'malva-offer');

export function product(key: string): ProductDraft {
  const found = PRODUCTS.find((p) => p.key === key);
  if (!found) throw new Error(`No product ${key}`);
  return found;
}

export function variantsOf(p: ProductDraft): VariantDraft[] {
  return [p.masterVariant, ...p.variants];
}

export function variant(p: ProductDraft, sku: string): VariantDraft {
  const found = variantsOf(p).find((v) => v.sku === sku);
  if (!found) throw new Error(`No variant ${sku} on ${p.key}`);
  return found;
}

export function attr(v: VariantDraft, name: string): unknown {
  return v.attributes.find((a) => a.name === name)?.value;
}

/** Master-variant attribute of a product. */
export function masterAttr(p: ProductDraft, name: string): unknown {
  return attr(p.masterVariant, name);
}

export function priceOf(v: VariantDraft, currency: 'USD' | 'EUR', policy?: string): PriceDraft | undefined {
  return v.prices.find((x) => x.value.currencyCode === currency && x.recurrencePolicy === policy);
}

export function nameEn(p: ProductDraft): string {
  return p.name['en-US'];
}
