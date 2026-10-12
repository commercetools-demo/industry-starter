// Supported CSV columns of the product import (W-13). Pure. Every other header is Unmapped; `fitment` can never be imported
// (D6: a local product cannot assert compatibility; add it per product for Malva review).
export const IMPORT_TARGETS = [
  'productType',
  'key',
  'sku',
  'name.de-DE',
  'name.en-US',
  'description.de-DE',
  'description.en-US',
  'slug.de-DE',
  'slug.en-US',
  'categories',
  'price',
] as const;
export type ImportTarget = (typeof IMPORT_TARGETS)[number];

export const LOCAL_PART_TYPE = 'mau-pt-local-part';

export const FITMENT_WARNING = "Fitment can't be imported; add it per product for Malva review";

export interface ColumnMapping {
  header: string;
  /** The target the column feeds, or null when Unmapped (ignored). */
  target: ImportTarget | null;
  warning?: string;
}

/** What the user chose for an unmapped header: a supported target or 'ignore'. */
export type MappingOverrides = Record<string, ImportTarget | 'ignore'>;

const isTarget = (v: string): v is ImportTarget => (IMPORT_TARGETS as readonly string[]).includes(v);
const FITMENT = /fitment|compatib|vehicle/i;

const ALIASES: Record<string, ImportTarget> = {
  producttype: 'productType',
  'product type': 'productType',
  'product-type': 'productType',
  variantsku: 'sku',
  'variant sku': 'sku',
  'name.de': 'name.de-DE',
  'name.en': 'name.en-US',
  'description.de': 'description.de-DE',
  'description.en': 'description.en-US',
  'slug.de': 'slug.de-DE',
  'slug.en': 'slug.en-US',
  category: 'categories',
};

/** Auto-mapping by exact target name (case-insensitive) and a few aliases; a user override wins; a fitment column never maps. */
export function mapColumns(headers: readonly string[], overrides: MappingOverrides = {}): ColumnMapping[] {
  const used = new Set<ImportTarget>();
  return headers.map((header) => {
    if (FITMENT.test(header)) return { header, target: null, warning: FITMENT_WARNING };
    const chosen = overrides[header];
    if (chosen === 'ignore') return { header, target: null };
    const lower = header.trim().toLowerCase();
    const auto = IMPORT_TARGETS.find((t) => t.toLowerCase() === lower) ?? ALIASES[lower];
    const target = chosen && isTarget(chosen) ? chosen : auto;
    if (!target || used.has(target)) return { header, target: null };
    used.add(target);
    return { header, target };
  });
}
