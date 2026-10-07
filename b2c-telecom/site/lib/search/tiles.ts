import { FALLBACK_CATEGORY_KEYS } from '@/lib/config/search';
import { categoryPath, findCategory } from '@/lib/listing/links';
import type { Category, Locale } from '@/lib/types';

export interface CategoryTile {
  key: string;
  name: string;
  /** `/shop/<slug>` without the locale prefix. */
  href: string;
}

/** The curated fallback categories resolved against the tree, in config order. A key the tree does not know is omitted and warned. */
export function resolveFallbackTiles(tree: Category[], locale: Locale, keys: readonly string[] = FALLBACK_CATEGORY_KEYS): CategoryTile[] {
  return keys.flatMap((key) => {
    const category = findCategory(tree, key);
    const href = categoryPath(key, locale, tree);
    if (!category || href === undefined) {
      console.warn('[search] fallback category missing', key);
      return [];
    }
    return [{ key, name: category.name, href }];
  });
}
