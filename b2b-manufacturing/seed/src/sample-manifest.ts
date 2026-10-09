import { PREFIX } from './lib';

/**
 * The reviewed list of sample resources to delete. `inventory-sample.ts` writes it, a human (or Claude through the
 * Merchant Center MCP) reviews it, `cleanup-sample.ts` deletes exactly these entries and nothing else (D15).
 */
export type Kind =
  | 'quotes' | 'staged-quotes' | 'quote-requests' | 'carts' | 'orders' | 'inventory' | 'products' | 'product-selections' | 'categories' | 'product-types' | 'types'
  | 'shipping-methods' | 'tax-categories' | 'stores' | 'zones' | 'customers' | 'business-units' | 'custom-objects';

/** Deletion order: dependants before what they reference. */
export const KIND_ORDER: Kind[] = [
  'orders', 'quotes', 'staged-quotes', 'quote-requests', 'carts', 'inventory', 'business-units', 'customers', 'custom-objects', 'stores',
  'product-selections', 'products', 'categories', 'product-types', 'shipping-methods', 'tax-categories', 'zones', 'types',
];

export interface ManifestEntry {
  kind: Kind;
  id: string;
  version: number;
  key?: string;
  name?: string;
  /** Category/business-unit depth (number of ancestors) so children are deleted before parents. */
  depth?: number;
  /** Custom objects need their container. */
  container?: string;
}

export interface Manifest {
  projectKey: string;
  createdAt: string;
  entries: ManifestEntry[];
}

/** True for anything the seed itself owns; such entries must never be in a deletion manifest. */
export const isSeedOwned = (e: { key?: string; container?: string }): boolean => Boolean(e.key?.startsWith(PREFIX) || e.container?.startsWith(PREFIX));

export function validateManifest(m: Manifest, projectKey: string): string[] {
  const errors: string[] = [];
  if (m.projectKey !== projectKey) errors.push(`manifest is for project "${m.projectKey}", not "${projectKey}"`);
  for (const e of m.entries) {
    if (!KIND_ORDER.includes(e.kind)) errors.push(`unknown kind "${e.kind}" (${e.id})`);
    if (isSeedOwned(e)) errors.push(`${e.kind} ${e.key ?? e.id} is owned by the seed (prefix ${PREFIX}) and must not be deleted by cleanup`);
  }
  return errors;
}

/** Order entries for deletion: by kind order, categories deepest first. Pure, stable. */
export function deletionOrder(entries: ManifestEntry[]): ManifestEntry[] {
  return [...entries].sort((a, b) => {
    const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (k !== 0) return k;
    if (a.kind === 'categories' || a.kind === 'business-units') return (b.depth ?? 0) - (a.depth ?? 0);
    return 0;
  });
}
