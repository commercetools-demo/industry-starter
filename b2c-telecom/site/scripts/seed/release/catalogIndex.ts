// Reads the project into a CatalogIndex (reads only). Validation, snapshot and preview are pure functions over this index.
import type { CtApi } from '../lib';
import { getAll, type Obj } from '../reconcilers/util';
import type { CatalogIndex, IndexDiscount, IndexOffer, IndexPrice, IndexVariant } from './types';

export const OFFER_TYPE = 'malva-offer';

type Ref = { id?: string; obj?: Obj & { key?: string } };

const PRODUCT_EXPAND = [
  'productType',
  'masterData.staged.categories[*]',
  'masterData.staged.masterVariant.prices[*].customerGroup',
  'masterData.staged.variants[*].prices[*].customerGroup',
  'masterData.staged.masterVariant.prices[*].recurrencePolicy',
  'masterData.staged.variants[*].prices[*].recurrencePolicy',
];

/** Enum values come back as { key, label }; the index keeps the key (also inside sets). */
export function normalizeAttribute(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeAttribute);
  if (value !== null && typeof value === 'object' && 'key' in value && 'label' in value) return (value as { key: unknown }).key;
  return value;
}

function toPrice(raw: Obj): IndexPrice {
  const value = raw.value as { centAmount: number; currencyCode: string };
  const group = raw.customerGroup as Ref | undefined;
  const policy = raw.recurrencePolicy as Ref | undefined;
  return {
    ...(typeof raw.key === 'string' ? { key: raw.key } : {}),
    centAmount: value.centAmount,
    currencyCode: value.currencyCode,
    ...(typeof raw.country === 'string' ? { country: raw.country } : {}),
    ...(group?.obj?.key ? { customerGroup: group.obj.key } : {}),
    ...(policy?.obj?.key ? { recurrencePolicy: policy.obj.key } : {}),
    ...(typeof raw.validFrom === 'string' ? { validFrom: raw.validFrom } : {}),
    ...(typeof raw.validUntil === 'string' ? { validUntil: raw.validUntil } : {}),
  };
}

function toVariant(raw: Obj): IndexVariant {
  const attributes: Record<string, unknown> = {};
  for (const a of (raw.attributes ?? []) as { name: string; value: unknown }[]) attributes[a.name] = normalizeAttribute(a.value);
  return { sku: String(raw.sku ?? ''), attributes, prices: ((raw.prices ?? []) as Obj[]).map(toPrice) };
}

function variantsOf(product: Obj): IndexVariant[] {
  const staged = (product.masterData as { staged: Obj }).staged;
  return [staged.masterVariant as Obj, ...((staged.variants ?? []) as Obj[])].map(toVariant);
}

/** The offer view of an expanded product; null when the product is not a malva-offer. */
export function toIndexOffer(product: Obj): IndexOffer | null {
  const md = product.masterData as { published: boolean; staged: Obj };
  const typeKey = ((product.productType as Ref).obj?.key as string | undefined) ?? '';
  if (typeKey !== OFFER_TYPE) return null;
  const staged = md.staged;
  return {
    key: String(product.key ?? ''),
    published: md.published,
    name: staged.name as Record<string, string>,
    ...(staged.description ? { description: staged.description as Record<string, string> } : {}),
    categories: ((staged.categories ?? []) as Ref[]).map((c) => c.obj?.key ?? '').filter(Boolean),
    variants: variantsOf(product),
  };
}

/** One offer, freshly read (null when the product does not exist). */
export async function readOffer(api: CtApi, key: string): Promise<IndexOffer | null> {
  const product = (await api.get(`products/key=${key}`, { expand: PRODUCT_EXPAND })) as Obj | null;
  return product ? toIndexOffer(product) : null;
}

export async function buildCatalogIndex(api: CtApi): Promise<CatalogIndex> {
  const [products, categories, taxCategories, policies, discounts, productTypes] = await Promise.all([
    getAll(api, 'products', { expand: PRODUCT_EXPAND }),
    getAll(api, 'categories'),
    getAll(api, 'tax-categories'),
    getAll(api, 'recurrence-policies'),
    getAll(api, 'cart-discounts'),
    getAll(api, 'product-types'),
  ]);
  const offers: IndexOffer[] = [];
  const skus: string[] = [];
  const priceKeys: string[] = [];
  const productKeys: string[] = [];
  for (const product of products) {
    const key = String(product.key ?? '');
    if (key) productKeys.push(key);
    for (const v of variantsOf(product)) {
      skus.push(v.sku);
      for (const p of v.prices) if (p.key) priceKeys.push(p.key);
    }
    const offer = toIndexOffer(product);
    if (offer) offers.push(offer);
  }
  const lineItemAttributes = new Set<string>();
  for (const type of productTypes) {
    for (const a of (type.attributes ?? []) as { name: string; savedToLineItem?: boolean }[]) if (a.savedToLineItem === true) lineItemAttributes.add(a.name);
  }
  const keysOf = (items: Obj[]): string[] => items.map((i) => String(i.key ?? '')).filter(Boolean);
  const indexDiscounts: IndexDiscount[] = discounts.map((d) => ({
    key: String(d.key ?? ''),
    sortOrder: String(d.sortOrder ?? ''),
    isActive: d.isActive === true,
    ...(typeof d.validFrom === 'string' ? { validFrom: d.validFrom } : {}),
    ...(typeof d.validUntil === 'string' ? { validUntil: d.validUntil } : {}),
  }));
  return {
    offers,
    productKeys,
    skus,
    priceKeys,
    categories: keysOf(categories),
    taxCategories: keysOf(taxCategories),
    recurrencePolicies: keysOf(policies),
    discounts: indexDiscounts,
    lineItemAttributes: [...lineItemAttributes],
  };
}

export function emptyIndex(): CatalogIndex {
  return { offers: [], productKeys: [], skus: [], priceKeys: [], categories: [], taxCategories: [], recurrencePolicies: [], discounts: [], lineItemAttributes: [] };
}
