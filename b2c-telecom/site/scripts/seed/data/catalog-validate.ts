// Offline validation of the Malva catalog manifest (pure, no network): SKU pattern, owned keys, locale completeness,
// shared attribute definitions, price completeness and reference existence. F's validateManifest adds the platform-level checks.
import type { AttributeDefinitionDraft, ProductDraft, ProductTypeDraft, SeedManifest, VariantDraft } from '../types';

export const SKU_PATTERN = /^MLV-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+(-[A-Z0-9]+)*$/;
const LOCALES = ['en-US', 'de-DE'];

export function allVariants(product: ProductDraft): VariantDraft[] {
  return [product.masterVariant, ...product.variants];
}

function isLocalized(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0 && Object.keys(value).every((k) => /^[a-z]{2}-[A-Z]{2}$/.test(k));
}

/** Every localized string in the value (recursively) has en-US and de-DE, both non-empty. */
export function localeGaps(value: unknown, where: string): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => localeGaps(v, `${where}[${i}]`));
  if (value === null || typeof value !== 'object') return [];
  if (isLocalized(value)) return LOCALES.filter((l) => !value[l] || value[l].trim() === '').map((l) => `${where}: missing ${l}`);
  return Object.entries(value).flatMap(([k, v]) => localeGaps(v, `${where}.${k}`));
}

export function skuErrors(products: ProductDraft[]): string[] {
  const errors: string[] = [];
  for (const product of products) {
    for (const variant of allVariants(product)) {
      if (!SKU_PATTERN.test(variant.sku)) errors.push(`SKU "${variant.sku}" does not match the pattern`);
      if (variant.key !== variant.sku.toLowerCase()) errors.push(`Variant key of "${variant.sku}" is not the lower-cased SKU`);
    }
  }
  return errors;
}

export function ownedKeyErrors(manifest: SeedManifest): string[] {
  const errors: string[] = [];
  for (const [kind, drafts] of Object.entries(manifest)) {
    if (kind === 'customerGroup' || kind === 'zoneCoverage' || kind === 'customObject') continue;
    for (const draft of drafts ?? []) {
      if (!draft.key.startsWith('malva-')) errors.push(`${kind} key "${draft.key}" has no malva- prefix`);
    }
  }
  return errors;
}

function sharedShape(def: AttributeDefinitionDraft): unknown {
  return { type: def.type, attributeConstraint: def.attributeConstraint ?? 'None', level: def.level ?? 'Variant', isSearchable: def.isSearchable ?? true, savedToLineItem: def.savedToLineItem ?? false };
}

/** One definition per attribute name: same type, constraint, level, searchability and line item flag (labels and requiredness may differ). */
export function sharedDefinitionErrors(types: ProductTypeDraft[]): string[] {
  const byName = new Map<string, { type: string; shape: string }[]>();
  for (const type of types) {
    for (const def of type.attributes) {
      byName.set(def.name, [...(byName.get(def.name) ?? []), { type: type.key, shape: JSON.stringify(sharedShape(def)) }]);
    }
  }
  const errors: string[] = [];
  for (const [name, uses] of byName) {
    const first = uses[0];
    for (const use of uses.slice(1)) {
      if (use.shape !== first.shape) errors.push(`Attribute "${name}" is defined differently in ${first.type} and ${use.type}`);
    }
  }
  return errors;
}

/** The platform rejects `isRequired: true` on set attributes (found live in G-17). */
export function setRequiredErrors(types: ProductTypeDraft[]): string[] {
  return types.flatMap((t) => t.attributes.filter((a) => a.isRequired && a.type.name === 'set').map((a) => `${t.key}.${a.name}: isRequired is not supported for set attributes`));
}

/** Offers: every variant has a non-zero USD/US and EUR/DE price; every price key is unique. */
export function priceErrors(offers: ProductDraft[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const offer of offers) {
    for (const variant of allVariants(offer)) {
      for (const [currency, country] of [['USD', 'US'], ['EUR', 'DE']] as const) {
        if (!variant.prices.some((p) => p.value.currencyCode === currency && p.country === country)) errors.push(`${variant.sku} has no ${currency}/${country} price`);
      }
      for (const price of variant.prices) {
        if (price.value.centAmount <= 0) errors.push(`${variant.sku} has a zero price (${price.key})`);
        if (keys.has(price.key)) errors.push(`Duplicate price key ${price.key}`);
        keys.add(price.key);
      }
    }
  }
  return errors;
}

const RELATION_ATTRIBUTES = ['anchors', 'included-offers', 'compatible-addons', 'compatible-equipment', 'conflicts-with', 'included-addons', 'incompatible-with'];

/** Every key named by a relation attribute exists as a product. */
export function referenceErrors(products: ProductDraft[]): string[] {
  const keys = new Set(products.map((p) => p.key));
  const errors: string[] = [];
  for (const product of products) {
    for (const variant of allVariants(product)) {
      for (const attribute of variant.attributes) {
        if (!RELATION_ATTRIBUTES.includes(attribute.name) || !Array.isArray(attribute.value)) continue;
        for (const target of attribute.value as string[]) {
          if (!keys.has(target)) errors.push(`${product.key}.${attribute.name} names "${target}", which does not exist`);
        }
      }
    }
  }
  return errors;
}

/** Everything above in one call. Empty = valid. */
export function validateCatalog(manifest: SeedManifest): string[] {
  const products = (manifest.product ?? []) as ProductDraft[];
  const offers = products.filter((p) => p.productType === 'malva-offer');
  return [
    ...ownedKeyErrors(manifest),
    ...skuErrors(products),
    ...sharedDefinitionErrors((manifest.productType ?? []) as ProductTypeDraft[]),
    ...setRequiredErrors((manifest.productType ?? []) as ProductTypeDraft[]),
    ...priceErrors(offers),
    ...referenceErrors(products),
    ...Object.entries(manifest).flatMap(([kind, drafts]) => localeGaps(drafts, kind)),
  ];
}
