// Pure manifest validation that runs before any write. Reads (GET by key) are allowed to resolve references.
import { isOwnedKey } from './config';
import type { CtApi } from './lib';
import {
  COLLECTION,
  type AnyReconciler,
  type AttributeDefinitionDraft,
  type AttributeType,
  type Draft,
  type InventoryDraft,
  type Kind,
  type ProductDraft,
  type ProductTypeDraft,
  type SeedManifest,
  type VariantDraft,
} from './types';

export interface ValidationError {
  kind: Kind;
  key: string;
  message: string;
}

const LOCALE_KEY = /^[a-z]{2}-[A-Z]{2}$/;
const REQUIRED_LOCALES = ['en-US', 'de-DE'];
const ATTRIBUTE_IN_PREDICATE = /attributes\.(?:`([^`]+)`|([A-Za-z0-9_-]+))/g;
/** Kinds whose key is not a `malva-` key (zoneCoverage uses the country code). */
const UNOWNED_KEY_KINDS: Kind[] = ['zoneCoverage'];

export function danglingMessage(from: { kind: Kind; key: string }, kind: Kind, key: string): string {
  return `Dangling reference: ${from.kind} "${from.key}" references ${kind} "${key}", which no manifest defines and the project does not hold`;
}

function drafts(manifest: SeedManifest, kind: Kind): Draft[] {
  return manifest[kind] ?? [];
}

function checkLocalized(value: unknown, kind: Kind, key: string, where: string, errors: ValidationError[]): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkLocalized(v, kind, key, `${where}[${i}]`, errors));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const isLocalized = keys.length > 0 && keys.every((k) => LOCALE_KEY.test(k) && typeof record[k] === 'string');
  if (isLocalized) {
    for (const locale of REQUIRED_LOCALES) {
      if (!(locale in record)) errors.push({ kind, key, message: `Missing ${locale} text in ${where}` });
    }
    return;
  }
  for (const [k, v] of Object.entries(record)) checkLocalized(v, kind, key, `${where}.${k}`, errors);
}

function enumKeys(type: AttributeType): string[] | undefined {
  if (type.name === 'enum' || type.name === 'lenum') return type.values.map((v) => v.key);
  if (type.name === 'set') return enumKeys(type.elementType);
  return undefined;
}

function checkValueShape(type: AttributeType, value: unknown): string | undefined {
  switch (type.name) {
    case 'text':
    case 'date':
    case 'time':
    case 'datetime':
      return typeof value === 'string' ? undefined : 'expected a string';
    case 'ltext':
      return value !== null && typeof value === 'object' ? undefined : 'expected a localized string object';
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'expected a boolean';
    case 'number':
      return typeof value === 'number' ? undefined : 'expected a number';
    case 'money': {
      const m = value as { centAmount?: unknown; currencyCode?: unknown } | null;
      return m && typeof m.centAmount === 'number' && typeof m.currencyCode === 'string' ? undefined : 'expected { currencyCode, centAmount }';
    }
    case 'enum':
    case 'lenum':
      if (typeof value !== 'string') return 'expected an enum key';
      return type.values.some((v) => v.key === value) ? undefined : `unknown enum value "${value}"`;
    case 'set': {
      if (!Array.isArray(value)) return 'expected an array';
      for (const item of value) {
        const problem = checkValueShape(type.elementType, item);
        if (problem) return problem;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function allVariants(product: ProductDraft): VariantDraft[] {
  return [product.masterVariant, ...product.variants];
}

export async function validateManifest(
  api: CtApi,
  manifest: SeedManifest,
  reconcilers: AnyReconciler[],
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const kinds = Object.keys(manifest) as Kind[];

  // keys unique per kind, owned, localized text complete
  for (const kind of kinds) {
    const seen = new Set<string>();
    for (const draft of drafts(manifest, kind)) {
      if (seen.has(draft.key)) errors.push({ kind, key: draft.key, message: `Duplicate key "${draft.key}" in ${kind}` });
      seen.add(draft.key);
      if (!UNOWNED_KEY_KINDS.includes(kind) && !isOwnedKey(kind, draft.key)) {
        errors.push({ kind, key: draft.key, message: `Key "${draft.key}" is not an owned key (malva- prefix) for ${kind}` });
      }
      checkLocalized(draft, kind, draft.key, kind, errors);
    }
  }

  // references
  const existsCache = new Map<string, boolean>();
  const exists = async (kind: Kind, key: string): Promise<boolean> => {
    const id = `${kind}:${key}`;
    const cached = existsCache.get(id);
    if (cached !== undefined) return cached;
    let found: boolean;
    if (kind === 'zoneCoverage') {
      const res = (await api.get(COLLECTION.zoneCoverage, { where: `locations(country="${key}")`, limit: 1 })) as { total?: number; results?: unknown[] } | null;
      found = (res?.results?.length ?? 0) > 0;
    } else {
      found = (await api.get(`${COLLECTION[kind]}/key=${key}`)) !== null;
    }
    existsCache.set(id, found);
    return found;
  };
  for (const reconciler of reconcilers) {
    for (const draft of drafts(manifest, reconciler.kind)) {
      for (const ref of reconciler.refs(draft)) {
        if (drafts(manifest, ref.kind).some((d) => d.key === ref.key)) continue;
        if (await exists(ref.kind, ref.key)) continue;
        errors.push({ kind: ref.from.kind, key: ref.from.key, message: danglingMessage(ref.from, ref.kind, ref.key) });
      }
    }
  }

  // SKUs and price keys
  const products = drafts(manifest, 'product') as ProductDraft[];
  const skus = new Set<string>();
  const priceKeys = new Set<string>();
  for (const product of products) {
    for (const variant of allVariants(product)) {
      if (skus.has(variant.sku)) errors.push({ kind: 'product', key: product.key, message: `Duplicate SKU "${variant.sku}"` });
      skus.add(variant.sku);
      for (const price of variant.prices) {
        if (priceKeys.has(price.key)) errors.push({ kind: 'product', key: product.key, message: `Duplicate price key "${price.key}"` });
        priceKeys.add(price.key);
      }
    }
  }
  for (const inv of drafts(manifest, 'inventory') as InventoryDraft[]) {
    if (!skus.has(inv.sku) && products.length > 0) {
      errors.push({ kind: 'inventory', key: inv.key, message: `Inventory SKU "${inv.sku}" is not a variant SKU of any product` });
    }
  }

  // attribute values
  const productTypes = drafts(manifest, 'productType') as ProductTypeDraft[];
  for (const product of products) {
    const type = productTypes.find((t) => t.key === product.productType);
    if (!type) continue;
    for (const variant of allVariants(product)) {
      for (const attribute of variant.attributes) {
        const def = type.attributes.find((a) => a.name === attribute.name);
        if (!def) {
          errors.push({ kind: 'product', key: product.key, message: `Variant "${variant.sku}": unknown attribute "${attribute.name}" for product type "${type.key}"` });
          continue;
        }
        const problem = checkValueShape(def.type, attribute.value);
        if (problem) {
          const keys = enumKeys(def.type);
          const hint = keys ? ` (allowed: ${keys.join(', ')})` : '';
          errors.push({ kind: 'product', key: product.key, message: `Variant "${variant.sku}": attribute "${attribute.name}" ${problem}${hint}` });
        }
      }
    }
  }

  // predicates reference attributes that exist and are saved to the line item
  const lineItemAttributes = new Set<string>();
  const anyTypeKnown = await collectLineItemAttributes(api, productTypes, lineItemAttributes);
  if (anyTypeKnown) {
    for (const kind of kinds) {
      for (const draft of drafts(manifest, kind)) {
        for (const text of predicateTexts(draft)) {
          for (const match of text.matchAll(ATTRIBUTE_IN_PREDICATE)) {
            const name = match[1] ?? match[2];
            if (!lineItemAttributes.has(name)) {
              errors.push({ kind, key: draft.key, message: `Predicate references attribute "${name}" which no product type defines with savedToLineItem: true` });
            }
          }
        }
      }
    }
  }
  return errors;
}

function predicateTexts(draft: Draft): string[] {
  const record = draft as unknown as Record<string, unknown>;
  const out: string[] = [];
  for (const field of ['predicate', 'cartPredicate']) {
    if (typeof record[field] === 'string') out.push(record[field] as string);
  }
  const target = record.target as { predicate?: unknown } | undefined;
  if (target && typeof target.predicate === 'string') out.push(target.predicate);
  return out;
}

/** Returns false when no product type is defined anywhere yet (predicates cannot be checked before G seeds them). */
async function collectLineItemAttributes(api: CtApi, manifestTypes: ProductTypeDraft[], into: Set<string>): Promise<boolean> {
  const add = (attrs: AttributeDefinitionDraft[]): void => {
    for (const a of attrs) if (a.savedToLineItem === true) into.add(a.name);
  };
  let any = manifestTypes.length > 0;
  for (const t of manifestTypes) add(t.attributes);
  const res = (await api.get(COLLECTION.productType, { limit: 500 })) as { results?: { attributes?: AttributeDefinitionDraft[] }[] } | null;
  for (const t of res?.results ?? []) {
    any = true;
    add(t.attributes ?? []);
  }
  return any;
}
