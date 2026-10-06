import 'server-only';
import type { Attribute, ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import type { IncrementUnit, Price, Product, Variant } from '../types';
import { getLocalizedString } from '../utils';

export interface MapContext { locale: string; currency: string; country: string }

const UNITS: readonly IncrementUnit[] = ['g', 'kg', 'ml', 'l', 'each'];
const STORAGE = ['ambient', 'chilled', 'frozen'] as const;

type AttrValue = string | number | boolean | string[];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isLocalized = (v: unknown): v is Record<string, string> => isRecord(v) && Object.values(v).every((x) => typeof x === 'string');

/** Flatten a commercetools attribute value into a primitive or string list. Returns undefined for unsupported shapes. */
function flattenAttribute(value: unknown, locale: string): AttrValue | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const flat = flattenAttribute(item, locale);
      return flat === undefined ? [] : Array.isArray(flat) ? flat : [String(flat)];
    });
  }
  if (isRecord(value)) {
    if (typeof value.key === 'string' && 'label' in value) return value.key; // enum / lenum
    if (typeof value.id === 'string' && typeof value.typeId === 'string') return value.id; // reference
    if (isLocalized(value)) return getLocalizedString(value, locale); // ltext
  }
  return undefined;
}

function attributeMap(attributes: Attribute[] | undefined): Map<string, unknown> {
  return new Map((attributes ?? []).map((a) => [a.name, a.value as unknown]));
}

const asString = (v: unknown, locale: string): string | undefined => {
  const flat = flattenAttribute(v, locale);
  return typeof flat === 'string' && flat !== '' ? flat : undefined;
};
const asStringList = (v: unknown, locale: string): string[] => {
  const flat = flattenAttribute(v, locale);
  return Array.isArray(flat) ? flat : typeof flat === 'string' ? [flat] : [];
};

function mapPrice(price: ProductVariant['price']): Price | undefined {
  if (!price) return undefined;
  const { centAmount, currencyCode } = price.value;
  const discounted = price.discounted?.value;
  return {
    centAmount,
    currencyCode,
    ...(discounted ? { discounted: { centAmount: discounted.centAmount, currencyCode: discounted.currencyCode } } : {}),
  };
}

function mapVariant(variant: ProductVariant, locale: string): Variant {
  const attrs = attributeMap(variant.attributes);
  const attributes: Record<string, AttrValue> = {};
  for (const [name, value] of attrs) {
    const flat = flattenAttribute(value, locale);
    if (flat !== undefined) attributes[name] = flat;
  }
  const rawUnit = asString(attrs.get('incrementUnit'), locale);
  const unit = UNITS.find((u) => u === rawUnit) ?? 'each';
  const incrementValue = attrs.get('incrementValue');
  return {
    id: variant.id,
    sku: variant.sku ?? '',
    images: (variant.images ?? []).map((i) => i.url),
    price: mapPrice(variant.price),
    attributes,
    increment: {
      value: typeof incrementValue === 'number' ? incrementValue : 1,
      unit,
      label: asString(attrs.get('packLabel'), locale) ?? '',
    },
    approximateWeight: attrs.get('approximateWeight') === true,
    availability: {
      isOnStock: variant.availability?.isOnStock ?? false,
      availableQuantity: variant.availability?.availableQuantity ?? 0,
    },
  };
}

/** Pure mapping from an SDK product projection to the app `Product`. `variants[0]` is the master variant. */
export function mapProduct(projection: ProductProjection, ctx: MapContext): Product {
  const { locale } = ctx;
  const master = attributeMap(projection.masterVariant.attributes);
  const storage = asString(master.get('storage'), locale);
  return {
    type: 'Product',
    id: projection.id,
    key: projection.key,
    name: getLocalizedString(projection.name, locale),
    slug: getLocalizedString(projection.slug, locale),
    description: getLocalizedString(projection.description, locale),
    brand: asString(master.get('brand'), locale),
    origin: asString(master.get('origin'), locale),
    storage: STORAGE.find((s) => s === storage),
    dietary: asStringList(master.get('dietary'), locale),
    allergens: asStringList(master.get('allergens'), locale),
    recurringEligible: master.get('recurringEligible') === true,
    categoryIds: projection.categories.map((c) => c.id),
    substituteProductIds: asStringList(master.get('substituteProducts'), locale),
    variants: [projection.masterVariant, ...projection.variants].map((v) => mapVariant(v, locale)),
  };
}
