import { getPriceBands } from './config/price-bands';
import type { Category, ListingFacets } from './types';

/** Serializable data the server page hands to the client filter components. */
export interface ListingFilterData {
  currency: string;
  /** Flattened category tree (depth-first); `count` includes the subcategories. */
  categories: { slug: string; name: string; count: number; depth: number }[];
  /** Products matching the other filters, shown on the "Everything" category row. */
  total: number;
  priceBands: { id: string; min?: number; max?: number; count: number }[];
  availability: { inStock: number; outOfStock: number };
}

/** Depth-first lookup of a category by its (localized) slug; `undefined` for an unknown slug. */
export function findCategoryBySlug(tree: Category[], slug: string): Category | undefined {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const inChildren = node.children ? findCategoryBySlug(node.children, slug) : undefined;
    if (inChildren) return inChildren;
  }
  return undefined;
}

/** Depth-first lookup of a category by id (the product page links back to its first category). */
export function findCategoryById(tree: Category[], id: string): Category | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const inChildren = node.children ? findCategoryById(node.children, id) : undefined;
    if (inChildren) return inChildren;
  }
  return undefined;
}

/** The facet counts direct categories only; a parent shows its own products plus those of its subcategories. */
function rolledUp(node: Category, direct: Map<string, number>): number {
  return (direct.get(node.id) ?? 0) + (node.children ?? []).reduce((sum, child) => sum + rolledUp(child, direct), 0);
}

function flatten(tree: Category[], direct: Map<string, number>, depth = 0): ListingFilterData['categories'] {
  return tree.flatMap((node) => [
    { slug: node.slug, name: node.name, count: rolledUp(node, direct), depth },
    ...flatten(node.children ?? [], direct, depth + 1),
  ]);
}

/**
 * Serializable data for the client filter components.
 * `facets` carry the counts "as if the group itself were not filtered" (see `loadListing`), so the rail shows what
 * each choice would give with the other filters applied.
 */
export function buildFilterData(args: {
  tree: Category[];
  facets: ListingFacets;
  /** Products matching the other filters without the category filter. */
  categoryTotal: number;
  currency: string;
}): ListingFilterData {
  const direct = new Map(args.facets.categories.map((c) => [c.id, c.count]));
  const counts = new Map(args.facets.priceBands.map((b) => [b.id, b.count]));
  return {
    currency: args.currency,
    categories: flatten(args.tree, direct),
    total: args.categoryTotal,
    priceBands: getPriceBands(args.currency).map((band) => ({ ...band, count: counts.get(band.id) ?? 0 })),
    availability: args.facets.availability,
  };
}
