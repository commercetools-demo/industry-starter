import type { Category, Locale, Offer } from '@/lib/types';

// Pure link helpers of the catalog surface (D-052). Offers and categories are linked ONLY through these functions: the home page,
// search, the bundle and the listing itself all call them, so every offer has one canonical link.

const LOCALES: readonly Locale[] = ['en-US', 'de-DE'];

function flatten(tree: Category[]): Category[] {
  return tree.flatMap((node) => [node, ...flatten(node.children)]);
}

export function findCategory(tree: Category[], key: string): Category | undefined {
  return flatten(tree).find((category) => category.key === key);
}

/** Data rule (plp-led-catalog-navigation): an offer's link target is the FIRST category it is assigned to. */
export function primaryCategoryKey(offer: Pick<Offer, 'primaryCategoryKey' | 'categoryKeys'>): string | undefined {
  return offer.primaryCategoryKey ?? offer.categoryKeys[0];
}

/** `/shop/<slug>` in the slug of `locale` (no locale prefix: for the locale-aware `Link`); undefined for an unknown category. */
export function categoryPath(key: string, locale: Locale, tree: Category[]): string | undefined {
  const category = findCategory(tree, key);
  return category ? `/shop/${category.slugs[locale] ?? category.slug}` : undefined;
}

export function categoryHref(key: string, locale: Locale, tree: Category[]): string | undefined {
  const path = categoryPath(key, locale, tree);
  return path === undefined ? undefined : `/${locale}${path}`;
}

/** The canonical link of one offer, without locale prefix, or undefined when its primary category is not in the tree. */
export function offerPath(offer: Pick<Offer, 'key' | 'primaryCategoryKey' | 'categoryKeys'>, locale: Locale, tree: Category[]): string | undefined {
  const primary = primaryCategoryKey(offer);
  const path = primary === undefined ? undefined : categoryPath(primary, locale, tree);
  return path === undefined ? undefined : `${path}?offer=${offer.key}#offer-${offer.key}`;
}

/** `/<locale>/shop/<primary slug>?offer=<key>#offer-<key>`. The offer key does not depend on the locale, the slug does. */
export function offerHref(offer: Pick<Offer, 'key' | 'primaryCategoryKey' | 'categoryKeys'>, locale: Locale, tree: Category[]): string | undefined {
  const path = offerPath(offer, locale, tree);
  return path === undefined ? undefined : `/${locale}${path}`;
}

/** The element id of an offer card (the target of the `#` fragment). */
export const offerAnchorId = (offerKey: string): string => `offer-${offerKey}`;

/** `/<locale>/shop/<slug>` plus `?page=N` only for N > 1 (filters, sort and the offer anchor are not part of the canonical URL). */
export function canonicalListingPath(locale: Locale, slug: string, page: number): string {
  return `/${locale}/shop/${slug}${page > 1 ? `?page=${page}` : ''}`;
}

/** `hreflang` alternates: each locale with that locale's slug of the category. */
export function languageAlternates(category: Category): Record<string, string> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, `/${locale}/shop/${category.slugs[locale] ?? category.slug}`]));
}
