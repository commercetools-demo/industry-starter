// Pure walks over the category tree (no commercetools calls). Used by the listing for scope, breadcrumbs and card category names.
import type { Category } from '@/lib/types';

export function flattenTree(tree: Category[]): Category[] {
  return tree.flatMap((c) => [c, ...flattenTree(c.children)]);
}

/** Categories the web storefront shows in its navigation: instoreVisibility not set, `both` or `onlyOnline`. A hidden category hides its subtree. */
export function webVisibleTree(tree: Category[]): Category[] {
  return tree
    .filter((c) => !c.instoreVisibility || c.instoreVisibility === 'both' || c.instoreVisibility === 'onlyOnline')
    .map((c) => ({ ...c, children: webVisibleTree(c.children) }));
}

/** Categories the in-store shop shows: only `both` and `onlyInStore` (an unset category is not shown). A hidden category hides its subtree. */
export function instoreVisibleTree(tree: Category[]): Category[] {
  return tree
    .filter((c) => c.instoreVisibility === 'both' || c.instoreVisibility === 'onlyInStore')
    .map((c) => ({ ...c, children: instoreVisibleTree(c.children) }));
}

export function findCategory(tree: Category[], match: (c: Category) => boolean): Category | null {
  return flattenTree(tree).find(match) ?? null;
}

/** Root first, the category itself last; empty when the id is unknown. Walks parent ids in memory, no extra calls. */
export function breadcrumbOf(tree: Category[], id: string): Category[] {
  const byId = new Map(flattenTree(tree).map((c) => [c.id, c]));
  const path: Category[] = [];
  let cursor = byId.get(id);
  while (cursor && path.length < 10) {
    path.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return path;
}

export function rootOf(tree: Category[], id: string): Category | null {
  return breadcrumbOf(tree, id)[0] ?? null;
}

/** Name of the root category of the first known id: the card's category line ("Pods", "Coffee"). */
export function rootCategoryName(tree: Category[], ids: string[]): string {
  for (const id of ids) {
    const root = rootOf(tree, id);
    if (root) return root.name;
  }
  return '';
}

/** Key to id for every category that has a key (the `category` facet value to the search id). */
export function idByKey(tree: Category[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of flattenTree(tree)) if (c.key) out[c.key] = c.id;
  return out;
}
