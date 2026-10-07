import type { LocalizedString, ProductDraft, VariantDraft } from '../../types';
import { attrs, type AttributeValues } from '../catalog-types';

export const TAX_CATEGORY = 'malva-telecom-services';

export interface Copy {
  en: string;
  de: string;
}

export function loc(copy: Copy): LocalizedString {
  return { 'en-US': copy.en, 'de-DE': copy.de };
}

/** `malva-cable-500` -> `cable-500`; the offer of a product has key `malva-offer-<slug>`. */
export function slugOf(productKey: string): string {
  return productKey.replace(/^malva-/, '');
}
export function offerKeyOf(productKey: string): string {
  return `malva-offer-${slugOf(productKey)}`;
}

/** Descriptive products are published but not categorised or priced (D-010). */
export function descriptiveProduct(opts: {
  key: string;
  productType: string;
  name: Copy;
  description: Copy;
  variants: { sku: string; key?: string; values: AttributeValues }[];
}): ProductDraft {
  const [master, ...rest] = opts.variants.map(
    (v): VariantDraft => ({ sku: v.sku, key: v.key ?? v.sku.toLowerCase(), attributes: attrs(v.values), prices: [] }),
  );
  const slug = `${slugOf(opts.key)}-details`;
  return {
    key: opts.key,
    productType: opts.productType,
    name: loc(opts.name),
    slug: { 'en-US': slug, 'de-DE': slug },
    description: loc(opts.description),
    categories: [],
    taxCategory: TAX_CATEGORY,
    masterVariant: master,
    variants: rest,
    publish: true,
  };
}

export function highlightSet(items: Copy[]): LocalizedString[] {
  return items.map(loc);
}
