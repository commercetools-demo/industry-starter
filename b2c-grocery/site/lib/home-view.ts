import { CATEGORY_IMAGES } from './config/home-images';
import { rolledUp } from './listing-view';
import type { Category, ListingFacets } from './types';

export const SHOWCASE_SIZE = 6;

export interface ShowcaseItem {
  key: string;
  slug: string;
  name: string;
  image: string;
  /** Products in the category and its subcategories; `undefined` when the counts are unknown. */
  count?: number;
}

/**
 * The first six root categories (tree order = merchandiser order) with a placeholder image and a product count taken
 * from the facets of an all-products search. Without facets (or with an empty category facet) the count is omitted.
 */
export function buildShowcaseItems(tree: Category[], facets?: Pick<ListingFacets, 'categories'>): ShowcaseItem[] {
  const known = !!facets && facets.categories.length > 0;
  const direct = new Map((facets?.categories ?? []).map((c) => [c.id, c.count]));
  return tree.slice(0, SHOWCASE_SIZE).map((node) => ({
    key: node.key,
    slug: node.slug,
    name: node.name,
    image: CATEGORY_IMAGES[node.key] ?? '',
    count: known ? rolledUp(node, direct) : undefined,
  }));
}

/** Two digits minimum: 7 becomes "07", 36 stays "36". */
export const twoDigits = (n: number): string => String(n).padStart(2, '0');
