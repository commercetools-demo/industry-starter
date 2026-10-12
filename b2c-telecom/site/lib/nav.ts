import { PLAN_FINDER_PATH } from '@/lib/config/nav';
import type { Category, Locale } from '@/lib/types';

export interface NavItem {
  key: string;
  label: string;
  /** Path without the locale prefix, e.g. `/shop/cable-internet`. */
  path: string;
  /** Slugs of the root and ALL descendants, in every locale. */
  matchSlugs: string[];
}

function collectSlugs(category: Category, into: Set<string>): void {
  for (const slug of Object.values(category.slugs)) into.add(slug);
  into.add(category.slug);
  for (const child of category.children) collectSlugs(child, into);
}

/** One item per root category, in the order of the tree (the order is decided by H). */
export function buildNavItems(tree: Category[], locale: Locale): NavItem[] {
  return tree.map((root) => {
    const slugs = new Set<string>();
    collectSlugs(root, slugs);
    return {
      key: root.key,
      label: root.name,
      path: `/shop/${root.slugs[locale] ?? root.slug}`,
      matchSlugs: [...slugs],
    };
  });
}

/** `pathname` has no locale prefix. Only `/shop/<slug>` can be active; a child category activates its root. */
export function activeNavKey(pathname: string, items: NavItem[]): string | undefined {
  const match = /^\/shop\/([^/?#]+)\/?$/.exec(pathname);
  if (!match) return undefined;
  let slug = match[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return undefined;
  }
  return items.find((item) => item.matchSlugs.includes(slug))?.key;
}

/** `pathname` has no locale prefix: the plan finder and its sub-paths. */
export function isPlanFinderPath(pathname: string): boolean {
  return pathname === PLAN_FINDER_PATH || pathname.startsWith(`${PLAN_FINDER_PATH}/`);
}
