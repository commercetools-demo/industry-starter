import 'server-only';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { breadcrumbOf, idByKey, rootCategoryName } from '@/lib/category-tree';
import type { FilterChip } from '@/components/listing/ActiveFilters';
import type { Crumb } from '@/components/listing/Breadcrumbs';
import type { SortOption } from '@/components/listing/SortSelect';
import { getAttributeLabels } from '@/lib/ct/attribute-labels';
import { getCategoryByKey, getCategoryBySlug, getCategoryTree } from '@/lib/ct/categories';
import { getStoresForCountry } from '@/lib/ct/channels';
import { getListingProjections } from '@/lib/ct/products';
import { searchProducts, type SearchOutcome } from '@/lib/ct/search';
import type { SearchContext, SearchScope } from '@/lib/search/build';
import { CATEGORY_ROOTS, FACETS, FACET_BY_NAME, type CategoryRoot } from '@/lib/search/facet-config';
import { buildFacetGroups, toggled } from '@/lib/search/facets';
import {
  activeFilterCount, clearAllFilters, listingHref, parseListingParams, removeFilter, serializeListingParams,
  type ListingParams, type ListingScope, type SortKey,
} from '@/lib/search/params';
import { priceBandById } from '@/lib/search/price-bands';
import { getSession } from '@/lib/session';
import type { Category, FacetGroup, ProductSummary, Store } from '@/lib/types';
import { formatMoney, marketForLocale } from '@/lib/utils';

/**
 * Page assembly for the three listing routes and GET /api/search (workstream G, 3.7). Server Components call it
 * directly (BFF rule: they may call lib/ct). Reads in parallel: category tree, attribute labels, store list, session;
 * then search (ids), then projections with the shopper's price; then the view models. Exported for O and L widgets.
 */
export interface ListingInput {
  locale: string;
  scope: ListingScope;
  /** Category slug of `/category/[slug]`. */
  slug?: string;
  searchParams: Record<string, string | string[] | undefined>;
}

export interface ListingView {
  kind: 'ok';
  scope: ListingScope;
  params: ListingParams;
  /** Path without the locale prefix: `/category/<slug>`, `/shop` or `/search`. */
  basePath: string;
  category?: Category;
  crumbs: Crumb[];
  items: ProductSummary[];
  total: number;
  page: number;
  pageCount: number;
  groups: FacetGroup[];
  facetsFailed: boolean;
  /** The chosen collection store when the market offers collection. */
  store: Pick<Store, 'key' | 'name'> | null;
  chips: FilterChip[];
  clearAllHref: string;
  sortOptions: SortOption[];
  availHref: string;
  /** Serialized params without `q` and `page`, for the search input. */
  otherParams: string;
  apiScope: string;
  activeCount: number;
  noResults?: { categories: { name: string; href: string }[]; bestsellers: ProductSummary[] };
}

export type ListingResult =
  | ListingView
  | { kind: 'prompt'; scope: 'search'; params: ListingParams; basePath: string; crumbs: Crumb[] }
  | { kind: 'redirect'; href: string }
  | { kind: 'unsupported_language' };

interface Resolved {
  ctx: SearchContext;
  store: Store | null;
  tree: Category[];
}

async function resolve(locale: string): Promise<Resolved & { stores: Store[] }> {
  const market = marketForLocale(locale);
  const [session, tree] = await Promise.all([getSession(), getCategoryTree(locale)]);
  const stores = market.collection ? await getStoresForCountry(market.country, locale).catch(() => [] as Store[]) : [];
  const store = stores.find((s) => s.key === session.collectionStoreKey) ?? null;
  return {
    ctx: { locale, currency: market.currency, country: market.country, ...(store ? { storeChannelId: store.id } : {}) },
    store, tree, stores,
  };
}

function rootKeyOf(tree: Category[], category: Category | null): CategoryRoot | null {
  if (!category) return null;
  const key = breadcrumbOf(tree, category.id)[0]?.key?.replace(/^mcf-cat-/, '');
  return (CATEGORY_ROOTS as string[]).includes(key ?? '') ? (key as CategoryRoot) : null;
}

const camel = (v: string) => v.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const humanize = (key: string) => key.split('-').map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ');

/** Counts only: used by the mobile filter sheet through GET /api/search?countOnly=1. */
export async function loadCount(input: { locale: string; scopeParam: string; searchParams: ListingInput['searchParams'] }): Promise<{ total: number } | { status: 'unsupported_language' } | { status: 'unknown_scope' }> {
  const params = parseListingParams(input.searchParams, input.scopeParam === 'shop' ? 'shop' : 'category');
  const { ctx, tree } = await resolve(input.locale);
  let category: Category | null = null;
  if (input.scopeParam !== 'shop') {
    category = await getCategoryByKey(input.locale, input.scopeParam);
    if (!category) return { status: 'unknown_scope' };
  }
  const scope: SearchScope = { ...(category ? { categoryId: category.id } : {}), root: rootKeyOf(tree, category), categoryIdByKey: idByKey(tree) };
  const out = await searchProducts(ctx, scope, params, { limit: 0, withFacets: false });
  return out.status === 'ok' ? { total: out.total } : { status: 'unsupported_language' };
}

export async function loadListing(input: ListingInput): Promise<ListingResult> {
  const { locale, scope } = input;
  const params = parseListingParams(input.searchParams, scope);
  const t = await getTranslations({ locale, namespace: 'plp' });
  const market = marketForLocale(locale);
  const [{ ctx, store, tree }, attributeLabels] = await Promise.all([resolve(locale), getAttributeLabels(locale).catch(() => ({}))]);

  const category = scope === 'category' && input.slug ? await getCategoryBySlug(locale, input.slug) : null;
  if (scope === 'category' && !category) notFound();
  const basePath = scope === 'category' ? `/category/${encodeURIComponent(category!.slug)}` : scope === 'shop' ? '/shop' : '/search';

  const homeCrumb: Crumb = { label: t('breadcrumb.home'), href: '/' };
  const crumbs: Crumb[] =
    scope === 'category'
      ? [homeCrumb, ...breadcrumbOf(tree, category!.id).map((c) => ({ label: c.name, href: `/category/${encodeURIComponent(c.slug)}` }))]
      : [homeCrumb, { label: scope === 'search' ? t('breadcrumb.search') : t('breadcrumb.all') }];
  if (scope === 'category') delete crumbs[crumbs.length - 1]!.href;

  if (scope === 'search' && !params.q) return { kind: 'prompt', scope: 'search', params, basePath, crumbs };

  const searchScope: SearchScope = {
    ...(category ? { categoryId: category.id } : {}),
    root: rootKeyOf(tree, category),
    categoryIdByKey: idByKey(tree),
  };

  let outcome: SearchOutcome;
  let facetsFailed = false;
  try {
    outcome = await searchProducts(ctx, searchScope, params, { withFacets: true });
  } catch (e) {
    console.error(JSON.stringify({ event: 'listing_facets_failed', status: (e as { statusCode?: number })?.statusCode }));
    facetsFailed = true;
    outcome = await searchProducts(ctx, searchScope, params, { withFacets: false });
  }
  if (outcome.status === 'unsupported_language') return { kind: 'unsupported_language' };
  if (outcome.redirectToPage) {
    return { kind: 'redirect', href: listingHref(basePath, { ...params, page: outcome.redirectToPage }, scope) };
  }
  if (scope === 'category' && outcome.total === 0 && activeFilterCount(params) === 0 && !params.q) notFound();

  const projectionCtx = {
    locale, country: ctx.country, currency: ctx.currency,
    ...(ctx.storeChannelId ? { storeChannelId: ctx.storeChannelId } : {}),
    categoryName: (ids: string[]) => rootCategoryName(tree, ids),
  };
  const items = await getListingProjections(outcome.ids, { ...projectionCtx, matchedSkus: outcome.matchedSkus });

  const fmt = (cents: number) => formatMoney(cents, ctx.currency, locale);
  const valueLabel = (facet: string, value: string): string => {
    if (facet === 'rating') return t(`facetValue.rating.${value.replace('.', '_')}` as 'facetValue.rating.4_5');
    if (facet === 'collection') return t(`facetValue.collection.${camel(value)}` as 'facetValue.collection.new');
    if (facet === 'intensity') return t('facetValue.intensity', { n: value });
    if (facet === 'price') {
      const b = priceBandById(ctx.currency, value);
      if (!b) return value;
      if (b.from === undefined) return t('facetValue.price.under', { max: fmt(b.to!) });
      if (b.to === undefined) return t('facetValue.price.over', { min: fmt(b.from) });
      return t('facetValue.price.between', { min: fmt(b.from), max: fmt(b.to - 1) });
    }
    return value;
  };
  const groupLabel = (facet: string) => t(`facet.${facet}` as 'facet.category');

  const hrefFor = (facet: string, value: string) => listingHref(basePath, toggled(params, FACET_BY_NAME[facet]!, value), scope);
  const groups = buildFacetGroups(outcome.facets, params, {
    root: searchScope.root ?? null, attributeLabels, tree, scopeCategoryId: category?.id, groupLabel, valueLabel, hrefFor,
  });

  const labelOfSelected = (facet: string, value: string): string => {
    const g = groups.find((x) => x.name === facet);
    return g?.options.find((o) => o.value === value)?.label ?? (FACET_BY_NAME[facet]?.values ? valueLabel(facet, value) : humanize(value));
  };
  const chips: FilterChip[] = [];
  for (const def of FACETS) {
    for (const v of params.facets[def.name] ?? []) {
      chips.push({ key: `${def.name}:${v}`, label: labelOfSelected(def.name, v), href: listingHref(basePath, removeFilter(params, def.name, v), scope) });
    }
  }
  if (params.avail && store) {
    chips.push({ key: 'avail', label: t('chip.avail', { store: store.name }), href: listingHref(basePath, { ...params, avail: false, page: 1 }, scope) });
  }

  const useRelevance = scope === 'search' || Boolean(params.q);
  const sortValues: SortKey[] = [useRelevance ? 'relevance' : 'featured', 'price-asc', 'price-desc', 'rating'];
  const sortLabel: Record<string, string> = {
    relevance: t('sort.bestMatch'), featured: t('sort.featured'), 'price-asc': t('sort.priceAsc'), 'price-desc': t('sort.priceDesc'), rating: t('sort.rating'),
  };
  const sortOptions: SortOption[] = sortValues.map((v) => ({
    value: v, label: sortLabel[v]!, href: listingHref(basePath, { ...params, sort: v, page: 1 }, scope),
  }));

  const other = serializeListingParams({ ...params, q: undefined, page: 1 }, scope);
  const view: ListingView = {
    kind: 'ok', scope, params, basePath, ...(category ? { category } : {}), crumbs, items, total: outcome.total,
    page: outcome.page, pageCount: outcome.pageCount, groups, facetsFailed,
    store: market.collection && store ? { key: store.key, name: store.name } : null,
    chips, clearAllHref: listingHref(basePath, clearAllFilters(params, scope), scope),
    sortOptions, availHref: listingHref(basePath, { ...params, avail: !params.avail, page: 1 }, scope),
    otherParams: other.toString(), apiScope: category?.key ?? 'shop', activeCount: activeFilterCount(params),
  };

  if (outcome.total === 0 && params.q) {
    const bestsellers = await loadBestsellers(ctx, searchScope, projectionCtx);
    view.noResults = {
      categories: tree.map((c) => ({ name: c.name, href: `/category/${encodeURIComponent(c.slug)}` })),
      bestsellers,
    };
  }
  return view;
}

async function loadBestsellers(
  ctx: SearchContext,
  scope: SearchScope,
  projectionCtx: Parameters<typeof getListingProjections>[1],
): Promise<ProductSummary[]> {
  try {
    const params = parseListingParams({ f_collection: 'bestseller' }, 'shop');
    const out = await searchProducts(ctx, { categoryIdByKey: scope.categoryIdByKey }, params, { limit: 4, withFacets: false });
    return out.status === 'ok' ? await getListingProjections(out.ids, projectionCtx) : [];
  } catch {
    return [];
  }
}
