import 'server-only';
import { notFound } from 'next/navigation';
import { availabilityState } from '@/lib/availability';
import { breadcrumbOf, findCategory, idByKey, instoreVisibleTree, rootCategoryName } from '@/lib/category-tree';
import { getCategoryTree } from '@/lib/ct/categories';
import { getInventoryDetail } from '@/lib/ct/inventory';
import { getListingProjections } from '@/lib/ct/products';
import { searchProducts } from '@/lib/ct/search';
import { CATEGORY_ROOTS, type CategoryRoot } from '@/lib/search/facet-config';
import { parseListingParams } from '@/lib/search/params';
import { LOW_STOCK_THRESHOLD } from '@/lib/shop-config';
import type { AvailabilityState, Category, ProductSummary } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';

/**
 * Data of the In-store category page (workstream R, D-044). Reuses G's loaders (`searchProducts` without facets,
 * `getListingProjections`) and H's inventory read, and nothing else: no filters, no sort, no store, no ratings. Each row carries
 * only what a shopper in a store decides on: image, name, price, and whether it is in stock (the online stock, the figure the
 * bag checks).
 */
export interface InstoreRow {
  id: string;
  slug: string;
  /** Default variant SKU: the product page opens on it. */
  sku: string;
  name: string;
  imageUrl?: string;
  imageAlt: string;
  price: ProductSummary['price'];
  /** null when the stock read failed (the row then shows no availability rather than a wrong one). */
  availability: AvailabilityState | null;
}

export interface InstoreCategoryView {
  category: Category;
  /** Key of the root category (its icon is the tiles' icon). */
  rootKey?: string;
  /** The parent to go back to, or null at a root. */
  parent: { name: string; slug: string } | null;
  children: { id: string; name: string; slug: string; imageUrl?: string }[];
  rows: InstoreRow[];
  total: number;
  page: number;
  pageCount: number;
  /** Set when the requested page is past the last one. */
  redirectToPage?: number;
}

function rootKeyOf(tree: Category[], category: Category): CategoryRoot | null {
  const key = breadcrumbOf(tree, category.id)[0]?.key?.replace(/^mcf-cat-/, '');
  return (CATEGORY_ROOTS as string[]).includes(key ?? '') ? (key as CategoryRoot) : null;
}

/** Row view models with the stock of each default SKU. Pure given its inputs. */
export function toRows(items: ProductSummary[], online: Record<string, number> | null): InstoreRow[] {
  return items.map((p) => {
    const q = online?.[p.sku];
    return {
      id: p.id, slug: p.slug, sku: p.sku, name: p.name, ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}), imageAlt: p.imageAlt, price: p.price,
      availability: online === null || q === undefined ? null : availabilityState(q, LOW_STOCK_THRESHOLD),
    };
  });
}

/** The root categories, for the home tiles (cached public data, one read). */
export async function loadInstoreHome(locale: string): Promise<Category[]> {
  return instoreVisibleTree(await getCategoryTree(locale));
}

/** The name of a category, for the page title; null when unknown. */
export async function instoreCategoryName(locale: string, slug: string): Promise<string | null> {
  return findCategory(instoreVisibleTree(await getCategoryTree(locale)), (c) => c.slug === slug)?.name ?? null;
}

/** An unknown slug is a 404; a category with no products and no children is shown empty (a shopper can walk up). */
export async function loadInstoreCategory(locale: string, slug: string, pageParam: string | undefined): Promise<InstoreCategoryView> {
  const market = marketForLocale(locale);
  // Only `both` and `onlyInStore` categories exist in the shop; a hidden one (or one under a hidden parent) is a 404.
  const tree = instoreVisibleTree(await getCategoryTree(locale));
  const category = findCategory(tree, (c) => c.slug === slug);
  if (!category) notFound();

  const params = parseListingParams(pageParam ? { page: pageParam } : {}, 'category');
  const outcome = await searchProducts(
    { locale, currency: market.currency, country: market.country },
    { categoryId: category.id, root: rootKeyOf(tree, category), categoryIdByKey: idByKey(tree) },
    params,
    { withFacets: false },
  );
  const crumbs = breadcrumbOf(tree, category.id);
  const parentCrumb = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  const children = category.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug, ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}) }));
  const rootKey = crumbs[0]?.key;
  const base = {
    category, ...(rootKey ? { rootKey } : {}), parent: parentCrumb ? { name: parentCrumb.name, slug: parentCrumb.slug } : null, children,
  };
  if (outcome.status === 'unsupported_language') return { ...base, rows: [], total: 0, page: 1, pageCount: 1 };
  if (outcome.redirectToPage) return { ...base, rows: [], total: outcome.total, page: params.page, pageCount: outcome.pageCount, redirectToPage: outcome.redirectToPage };

  const items = await getListingProjections(outcome.ids, {
    locale, country: market.country, currency: market.currency, categoryName: (ids: string[]) => rootCategoryName(tree, ids),
  });
  let online: Record<string, number> | null = null;
  try {
    const detail = await getInventoryDetail(items.map((p) => p.sku));
    online = Object.fromEntries(Object.entries(detail).map(([sku, d]) => [sku, d.online]));
  } catch (e) {
    console.error(JSON.stringify({ event: 'instore_inventory_failed', status: (e as { statusCode?: number })?.statusCode }));
  }
  return { ...base, rows: toRows(items, online), total: outcome.total, page: outcome.page, pageCount: outcome.pageCount };
}
