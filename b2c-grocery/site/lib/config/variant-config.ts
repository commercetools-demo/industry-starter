import type { Product, Variant } from '../types';

/**
 * Which variant attributes become PDP selectors and how they look (D-023). Nothing about a product type is
 * hard-coded in components: add an attribute here to hide it, give it swatches or change its order.
 */
export const VARIANT_CONFIG = {
  /** Attributes that vary between variants but are never shown as a choice. */
  blocklist: ['approximateWeight', 'incrementValue', 'incrementUnit'],
  /** `swatch[attribute][value]` is a CSS color; an attribute with a mapping renders as swatch circles. */
  swatch: {} as Record<string, Record<string, string>>,
  /** Attributes shown as radios instead of a segmented control. */
  radio: [] as string[],
  /** `increment`: by `incrementValue` ascending; `alpha` (default): by label. */
  sort: { packLabel: 'increment' } as Record<string, 'increment' | 'alpha'>,
  /** Shown first. */
  primary: 'packLabel',
};

export type SelectorKind = 'segmented' | 'swatch' | 'radio';
export interface SelectorOption { value: string; label: string; sku: string | null; disabled: boolean }
export interface Selector { name: string; label: string; kind: SelectorKind; options: SelectorOption[]; selected: string }

const valueOf = (variant: Variant, name: string): string | undefined => {
  const raw = variant.attributes[name];
  return raw === undefined ? undefined : Array.isArray(raw) ? raw.join(', ') : String(raw);
};

/** "packLabel" -> "Pack label"; components prefer a translation (`pdp.options.<name>`) and use this as the fallback. */
const humanize = (name: string): string => {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** The variant shown when no (valid) `?sku=` is given: the first one in stock, else the first. */
export function pickVariant(product: Product, sku?: string): Variant | undefined {
  return product.variants.find((v) => v.sku === sku) ?? product.variants.find((v) => v.availability.isOnStock) ?? product.variants[0];
}

/**
 * Pure: selectors from the variants' own attributes. An attribute becomes a selector when its value differs between
 * variants and it is not blocklisted. An option's `sku` is the variant with that value and the other selectors'
 * current values (null when there is none, which disables it); an option without a purchasable variant is disabled
 * too, unless it is the current choice.
 */
export function buildSelectors(product: Product, sku?: string): Selector[] {
  const variants = product.variants;
  const current = pickVariant(product, sku);
  if (variants.length < 2 || !current) return [];

  const names = [...new Set(variants.flatMap((v) => Object.keys(v.attributes)))].filter((name) => {
    if (VARIANT_CONFIG.blocklist.includes(name)) return false;
    return new Set(variants.map((v) => valueOf(v, name))).size > 1;
  });
  names.sort((a, b) => (a === VARIANT_CONFIG.primary ? -1 : b === VARIANT_CONFIG.primary ? 1 : a.localeCompare(b)));

  return names.map((name) => {
    const others = names.filter((n) => n !== name);
    const matchesOthers = (v: Variant) => others.every((n) => valueOf(v, n) === valueOf(current, n));
    const values = [...new Set(variants.flatMap((v) => valueOf(v, name) ?? []))];
    const firstWith = (value: string) => variants.find((v) => valueOf(v, name) === value);
    if ((VARIANT_CONFIG.sort[name] ?? 'alpha') === 'increment') {
      values.sort((a, b) => (firstWith(a)?.increment.value ?? 0) - (firstWith(b)?.increment.value ?? 0));
    } else {
      values.sort((a, b) => a.localeCompare(b));
    }
    const selected = valueOf(current, name) ?? '';
    const kind: SelectorKind = VARIANT_CONFIG.swatch[name] ? 'swatch' : VARIANT_CONFIG.radio.includes(name) ? 'radio' : 'segmented';
    return {
      name,
      label: humanize(name),
      kind,
      selected,
      options: values.map((value) => {
        const matching = variants.filter((v) => valueOf(v, name) === value && matchesOthers(v));
        const target = matching.find((v) => v.availability.isOnStock) ?? matching[0] ?? null;
        return { value, label: value, sku: target?.sku ?? null, disabled: value !== selected && (!target || !target.availability.isOnStock) };
      }),
    };
  });
}
