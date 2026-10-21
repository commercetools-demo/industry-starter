import type { Selection } from '@/lib/product/resolve-variant';
import { NO_DEFAULT_SELECTORS } from '@/lib/product/variant-config';
import type { SelectorDef, VariantView } from '@/lib/types';

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Initial selection of the product page (workstream H, 3.2). The URL wins: `?capsulesPerPack=50&grind=filter` selects
 * those options when they exist. A required selector the URL leaves out starts on the landing variant's value (the path
 * SKU), except the selectors in NO_DEFAULT_SELECTORS (coffee grind) which start unselected so the shopper chooses.
 * Unknown values and unknown names are ignored.
 */
export function parseSelection(params: Params, selectors: SelectorDef[], landing: VariantView | undefined): Selection {
  const out: Selection = {};
  for (const s of selectors) {
    const wanted = first(params[s.attr]);
    if (wanted !== undefined && s.options.some((o) => o.value === wanted)) {
      out[s.attr] = wanted;
    } else if (!NO_DEFAULT_SELECTORS.includes(s.attr) && landing?.attrs[s.attr] !== undefined) {
      out[s.attr] = String(landing.attrs[s.attr]);
    }
  }
  return out;
}

/** The selector named by `?choose=<attr>` (set by Quick add), when it exists on this product. */
export function parseChoose(params: Params, selectors: SelectorDef[]): string | undefined {
  const wanted = first(params.choose);
  return selectors.find((s) => s.attr === wanted)?.attr;
}

/** Query string (with the leading `?`, empty when nothing is selected) that reproduces the selection. */
export function serializeSelection(selection: Selection, selectors: SelectorDef[]): string {
  const sp = new URLSearchParams();
  for (const s of selectors) {
    const value = selection[s.attr];
    if (value !== undefined) sp.set(s.attr, value);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

/** Variant to show while the selection is incomplete: the first one matching every selected value, else the landing one. */
export function previewVariant(variants: VariantView[], selection: Selection, landingSku: string): VariantView | undefined {
  const match = variants.find((v) => Object.entries(selection).every(([attr, value]) => value === undefined || String(v.attrs[attr]) === value));
  return match ?? variants.find((v) => v.sku === landingSku) ?? variants[0];
}
