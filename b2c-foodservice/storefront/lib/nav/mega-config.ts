import { buildListingHref, type FacetValue } from '@/lib/nav/listing-href';
import type { Category } from '@/lib/types';

/**
 * Menu structure. Categories are named by their seeded key (SEED-PLAN section 7), never by slug; the slug is resolved
 * from the category tree at render time. Labels are message keys under `shell.mega.*` (see the catalogues).
 */
export interface NavLink {
  /** Key under `shell.mega.` */
  labelKey: string;
  /** Category key (mcf-cat-*). Omitted: the menu's own category. */
  categoryKey?: string;
  /** Bare facet names; the listing href adds the `f_` prefix. */
  params?: Record<string, FacetValue>;
}

export type MenuId = 'pods' | 'coffee' | 'machines' | 'accessories';

export interface MegaMenuEntry {
  id: MenuId;
  categoryKey: string;
  feature: NavLink[];
  shop: NavLink[];
  /** Other primary entries shown under "More from Malva". */
  more: Array<MenuId | 'gifts'>;
}

export interface PrimaryNavItem {
  id: MenuId | 'gifts';
  /** Key under `shell.nav.` */
  labelKey: MenuId | 'gifts';
  categoryKey: string;
  hasMenu: boolean;
}

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { id: 'pods', labelKey: 'pods', categoryKey: 'mcf-cat-pods', hasMenu: true },
  { id: 'coffee', labelKey: 'coffee', categoryKey: 'mcf-cat-coffee', hasMenu: true },
  { id: 'machines', labelKey: 'machines', categoryKey: 'mcf-cat-machines', hasMenu: true },
  { id: 'accessories', labelKey: 'accessories', categoryKey: 'mcf-cat-accessories', hasMenu: true },
  { id: 'gifts', labelKey: 'gifts', categoryKey: 'mcf-cat-gifts', hasMenu: false },
];

const FEATURE: NavLink[] = [
  { labelKey: 'feature.newIn', params: { collection: 'new' } },
  { labelKey: 'feature.bestsellers', params: { collection: 'bestseller' } },
  { labelKey: 'feature.sets', categoryKey: 'mcf-cat-gifts' },
];

export const MEGA_CONFIG: Record<MenuId, MegaMenuEntry> = {
  pods: {
    id: 'pods',
    categoryKey: 'mcf-cat-pods',
    feature: FEATURE,
    shop: [
      { labelKey: 'link.original', categoryKey: 'mcf-cat-pods-original' },
      { labelKey: 'link.vertuo', categoryKey: 'mcf-cat-pods-vertuo' },
      { labelKey: 'link.intensity', params: { intensity: [8, 9, 10, 11, 12, 13] } },
      { labelKey: 'link.limited', params: { collection: 'limited-edition' } },
      { labelKey: 'link.decaf', params: { decaf: true } },
    ],
    more: ['coffee', 'machines', 'accessories', 'gifts'],
  },
  coffee: {
    id: 'coffee',
    categoryKey: 'mcf-cat-coffee',
    feature: FEATURE,
    shop: [
      { labelKey: 'link.beans', categoryKey: 'mcf-cat-coffee-beans' },
      { labelKey: 'link.ground', categoryKey: 'mcf-cat-coffee-ground' },
      { labelKey: 'link.singleOrigin', categoryKey: 'mcf-cat-coffee-single-origin' },
      { labelKey: 'link.blends', categoryKey: 'mcf-cat-coffee-blends' },
      { labelKey: 'link.subscriptions', params: { collection: 'subscribable' } },
    ],
    more: ['pods', 'machines', 'accessories', 'gifts'],
  },
  machines: {
    id: 'machines',
    categoryKey: 'mcf-cat-machines',
    feature: FEATURE,
    shop: [
      { labelKey: 'link.capsule', categoryKey: 'mcf-cat-machines-capsule' },
      { labelKey: 'link.beanToCup', categoryKey: 'mcf-cat-machines-bean-to-cup' },
      { labelKey: 'link.espresso', categoryKey: 'mcf-cat-machines-espresso' },
      { labelKey: 'link.filter', categoryKey: 'mcf-cat-machines-filter' },
      { labelKey: 'link.grinders', categoryKey: 'mcf-cat-machines-grinders' },
    ],
    more: ['pods', 'coffee', 'accessories', 'gifts'],
  },
  accessories: {
    id: 'accessories',
    categoryKey: 'mcf-cat-accessories',
    feature: FEATURE,
    shop: [
      { labelKey: 'link.cupsMugs', categoryKey: 'mcf-cat-accessories-cups-mugs' },
      { labelKey: 'link.frothers', categoryKey: 'mcf-cat-accessories-frothers' },
      { labelKey: 'link.care', categoryKey: 'mcf-cat-accessories-care' },
      { labelKey: 'link.storage', categoryKey: 'mcf-cat-accessories-storage' },
    ],
    more: ['pods', 'coffee', 'machines', 'gifts'],
  },
};

/** Brew-method strip under the Coffee panel; keys are the seed enum keys, labels `shell.mega.brew.<labelKey>`. */
export const BREW_METHODS: Array<{ key: string; labelKey: string }> = [
  { key: 'espresso', labelKey: 'espresso' },
  { key: 'filter', labelKey: 'filter' },
  { key: 'french-press', labelKey: 'frenchPress' },
  { key: 'moka', labelKey: 'moka' },
  { key: 'cold-brew', labelKey: 'coldBrew' },
];
export const BREW_CATEGORY_KEY = 'mcf-cat-coffee';

/** Depth-first search of the tree by category key. */
export function findCategoryByKey(tree: Category[], key: string): Category | null {
  for (const node of tree) {
    if (node.key === key) return node;
    const inChild = findCategoryByKey(node.children, key);
    if (inChild) return inChild;
  }
  return null;
}

/**
 * The listing href for a link, or null when its category is not in the tree (the caller renders no link and
 * a server warning is logged by `warnMissingCategories`, so there is never a dead link).
 */
export function resolveNavHref(tree: Category[], link: NavLink, menuCategoryKey: string): string | null {
  const category = findCategoryByKey(tree, link.categoryKey ?? menuCategoryKey);
  return category ? buildListingHref(category.slug, link.params) : null;
}

/** Category keys that the menus use but the tree lacks; the server layout logs these once per render in development. */
export function missingCategoryKeys(tree: Category[]): string[] {
  const keys = new Set<string>();
  for (const item of PRIMARY_NAV) keys.add(item.categoryKey);
  for (const entry of Object.values(MEGA_CONFIG)) {
    for (const link of [...entry.feature, ...entry.shop]) if (link.categoryKey) keys.add(link.categoryKey);
  }
  return [...keys].filter((k) => !findCategoryByKey(tree, k));
}
