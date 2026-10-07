import 'server-only';
import type { Category as SdkCategory } from '@commercetools/platform-sdk';
import { NAV_TIE_BREAK_ORDER } from '@/lib/config/nav';
import { getLocalizedString } from '@/lib/format';
import type { Category } from '@/lib/types';

export function mapCategory(sdk: SdkCategory, locale: string): Category {
  const image = sdk.assets?.[0]?.sources?.[0]?.uri;
  const imageAlt = image ? getLocalizedString(sdk.assets?.[0]?.name, locale) : '';
  return {
    id: sdk.id,
    key: sdk.key ?? sdk.id,
    name: getLocalizedString(sdk.name, locale),
    slug: getLocalizedString(sdk.slug, locale),
    slugs: { ...sdk.slug },
    ...(sdk.parent ? { parentId: sdk.parent.id } : {}),
    ...(sdk.orderHint ? { orderHint: sdk.orderHint } : {}),
    ...(image ? { image } : {}),
    ...(imageAlt ? { imageAlt } : {}),
    children: [],
  };
}

const warnedOrphans = new Set<string>();

function compare(a: Category, b: Category): number {
  const hintA = a.orderHint ?? '￿';
  const hintB = b.orderHint ?? '￿';
  if (hintA !== hintB) return hintA < hintB ? -1 : 1;
  const tieA = NAV_TIE_BREAK_ORDER.indexOf(a.key);
  const tieB = NAV_TIE_BREAK_ORDER.indexOf(b.key);
  const rankA = tieA === -1 ? Number.MAX_SAFE_INTEGER : tieA;
  const rankB = tieB === -1 ? Number.MAX_SAFE_INTEGER : tieB;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name);
}

/** Roots have no parent (or a parent that is not in the list: logged once). Siblings are sorted by order hint, tie-break order, name. */
export function buildCategoryTree(categories: Category[]): Category[] {
  const nodes = new Map<string, Category>(categories.map((category) => [category.id, { ...category, children: [] }]));
  const roots: Category[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      if (node.parentId && !warnedOrphans.has(node.key)) {
        warnedOrphans.add(node.key);
        console.warn('[catalog] category without a known parent treated as root', node.key);
      }
      roots.push(node);
    }
  }
  const sortDeep = (list: Category[]): Category[] => {
    list.sort(compare);
    for (const node of list) sortDeep(node.children);
    return list;
  };
  return sortDeep(roots);
}

/** Depth-first, parents before children. */
export function flattenTree(tree: Category[]): Category[] {
  return tree.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** The category's own key plus every descendant key (inclusive). */
export function findDescendantKeys(category: Category): string[] {
  return flattenTree([category]).map((node) => node.key);
}

/** Root to leaf; empty when the key is unknown. */
export function breadcrumbTrail(tree: Category[], key: string): Category[] {
  for (const node of tree) {
    if (node.key === key) return [node];
    const below = breadcrumbTrail(node.children, key);
    if (below.length > 0) return [node, ...below];
  }
  return [];
}

export interface CategorySlugMatch {
  category: Category;
  /** The locale whose slug matched; differs from the requested locale when the URL carries another locale's slug. */
  matchedLocale: string;
}

/** Slug of the requested locale first, then a slug of any other locale (locale switch keeps the path). */
export function findCategoryBySlug(tree: Category[], slug: string, locale: string): CategorySlugMatch | null {
  const all = flattenTree(tree);
  const own = all.find((category) => category.slugs[locale] === slug);
  if (own) return { category: own, matchedLocale: locale };
  for (const category of all) {
    const matchedLocale = Object.keys(category.slugs).find((candidate) => category.slugs[candidate] === slug);
    if (matchedLocale) return { category, matchedLocale };
  }
  return null;
}
