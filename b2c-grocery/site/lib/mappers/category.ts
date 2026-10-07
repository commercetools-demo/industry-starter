import 'server-only';
import type { Category as SdkCategory } from '@commercetools/platform-sdk';
import type { Category } from '../types';
import { getLocalizedString } from '../utils';

export function mapCategory(category: SdkCategory, locale: string): Category {
  return {
    id: category.id,
    key: category.key ?? category.id,
    name: getLocalizedString(category.name, locale),
    slug: getLocalizedString(category.slug, locale),
    ...(category.parent ? { parentId: category.parent.id } : {}),
  };
}

/** commercetools order hints are compared as plain strings; categories without one go last. */
const byOrderHint = (a: SdkCategory, b: SdkCategory): number => {
  if (a.orderHint === b.orderHint) return 0;
  if (a.orderHint === undefined) return 1;
  if (b.orderHint === undefined) return -1;
  return a.orderHint < b.orderHint ? -1 : 1;
};

/**
 * Roots are categories without a parent. A category whose parent is not in the input (orphan) is treated as a root
 * so it stays reachable. Siblings are sorted by `orderHint`.
 */
export function buildCategoryTree(categories: SdkCategory[], locale: string): Category[] {
  const ids = new Set(categories.map((c) => c.id));
  const sorted = [...categories].sort(byOrderHint);
  const nodes = new Map<string, Category>(sorted.map((c) => [c.id, mapCategory(c, locale)]));
  const roots: Category[] = [];
  for (const c of sorted) {
    const node = nodes.get(c.id);
    if (!node) continue;
    const parent = c.parent && ids.has(c.parent.id) ? nodes.get(c.parent.id) : undefined;
    if (parent) (parent.children ??= []).push(node);
    else roots.push(node);
  }
  return roots;
}
