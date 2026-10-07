import { ApiError } from '@/lib/api-error';
import { LISTING_PAGE_SIZE } from '@/lib/config/facets';
import { MAX_HITS } from '@/lib/config/search';
import { dedupeByAnchors } from '@/lib/listing/visibility';
import { findCategory, offerHref, primaryCategoryKey } from '@/lib/listing/links';
import type { Category, Locale, Money, Offer, SearchCategoryCount, SearchResultItem, SearchView } from '@/lib/types';
import { isSearchableQuery, type SearchParams } from './params';

// Result assembly of the search page. Pure given its inputs: Product Search supplies ids (relevance order) and the SKUs it matched;
// the offers come from the buyer's visible catalog (K), so eligibility, release windows and de-duplication (N) already apply.

export interface SearchHit {
  id: string;
  matchedSkus: string[];
}

export interface RunSearchDeps {
  locale: Locale;
  tree: Category[];
  /** Languages configured in the project (`getSearchLanguages`). Read only for a searchable query. */
  getLanguages: () => Promise<string[]>;
  searchOfferHits: (input: { text: string; locale: Locale }) => Promise<{ total: number; hits: SearchHit[] }>;
  /** Offers this buyer may see in this market (`getVisibleOffers(market).offers`). */
  getOffers: () => Promise<Offer[]>;
}

const EMPTY = { total: 0, truncated: false, items: [] as SearchResultItem[], categories: [] as SearchCategoryCount[], page: 1, pageCount: 1 };

const kindOf = (offer: Offer): SearchResultItem['kind'] => (offer.kind === 'base-package' || offer.kind === 'bundle' ? 'plan' : offer.kind);

function fromPriceOf(offer: Offer): { price: Money | null; recurring: boolean } {
  const master = offer.variants[0];
  const recurring = offer.headline.recurring ?? master?.recurringPrice;
  if (recurring) return { price: recurring, recurring: true };
  return { price: offer.headline.oneTime ?? master?.oneTimePrice ?? null, recurring: false };
}

function highlightOf(offer: Offer): string | null {
  return offer.facts?.kind === 'plan' ? (offer.facts.highlights[0] ?? null) : null;
}

export async function runSearch(params: SearchParams, deps: RunSearchDeps): Promise<SearchView> {
  const query = params.q;
  if (!isSearchableQuery(query)) return { state: 'start', query, ...EMPTY };

  let result: Awaited<ReturnType<RunSearchDeps['searchOfferHits']>>;
  let offers: Offer[];
  try {
    // The URL locale is always a project language today; the guard protects against a mis-configured project.
    if (!(await deps.getLanguages()).includes(deps.locale)) return { state: 'unsupported-language', query, ...EMPTY };
    [result, offers] = await Promise.all([deps.searchOfferHits({ text: query, locale: deps.locale }), deps.getOffers()]);
  } catch (error) {
    // The query text is never logged (it may be personal data); only the code.
    console.error('[search] failed', { code: error instanceof ApiError ? error.code : 'UNKNOWN' });
    return { state: 'error', query, ...EMPTY };
  }

  // Hit order is kept. Unknown, hidden and restricted offers are simply not in `offers`.
  const byId = new Map(offers.map((offer) => [offer.id, offer]));
  const matchedSkusById = new Map(result.hits.map((hit) => [hit.id, hit.matchedSkus]));
  const hitOffers = dedupeByAnchors(result.hits.flatMap((hit) => (byId.has(hit.id) ? [byId.get(hit.id) as Offer] : [])));

  // Exact part number first (stable); several products matching one pasted identifier are all shown first, in API order.
  const wanted = query.toUpperCase();
  const exactSku = (offer: Offer): string | null => offer.variants.find((variant) => variant.sku.toUpperCase() === wanted)?.sku ?? null;
  const exact = hitOffers.filter((offer) => exactSku(offer) !== null);
  const ordered = [...exact, ...hitOffers.filter((offer) => exactSku(offer) === null)];

  const entries = ordered.flatMap((offer) => {
    const categoryKey = primaryCategoryKey(offer);
    const category = categoryKey === undefined ? undefined : findCategory(deps.tree, categoryKey);
    const href = offerHref(offer, deps.locale, deps.tree);
    if (categoryKey === undefined || !category || href === undefined) return [];
    const { price, recurring } = fromPriceOf(offer);
    const item: SearchResultItem = {
      offerKey: offer.key,
      name: offer.name,
      kind: kindOf(offer),
      categoryKey,
      categoryName: category.name,
      fromPrice: price,
      fromPriceRecurring: recurring,
      matchedSku: exactSku(offer) ?? matchedSkusById.get(offer.id)?.[0] ?? null,
      highlight: highlightOf(offer),
      href,
    };
    return [item];
  });

  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.categoryKey, (counts.get(entry.categoryKey) ?? 0) + 1);
  const flat = (nodes: Category[]): Category[] => nodes.flatMap((node) => [node, ...flat(node.children)]);
  const categories: SearchCategoryCount[] = flat(deps.tree).flatMap((node) => {
    const count = counts.get(node.key);
    return count ? [{ key: node.key, name: node.name, count }] : [];
  });

  const filtered = params.category === null ? entries : entries.filter((entry) => entry.categoryKey === params.category);
  const sorted =
    params.sort === 'relevance'
      ? filtered
      : [...filtered].sort((a, b) => {
          if (a.fromPrice === null || b.fromPrice === null) return a.fromPrice === b.fromPrice ? 0 : a.fromPrice === null ? 1 : -1;
          return params.sort === 'price-asc' ? a.fromPrice.centAmount - b.fromPrice.centAmount : b.fromPrice.centAmount - a.fromPrice.centAmount;
        });

  const pageCount = Math.max(1, Math.ceil(sorted.length / LISTING_PAGE_SIZE));
  const page = Math.min(Math.max(1, params.page), pageCount);
  return {
    state: sorted.length > 0 ? 'results' : 'none',
    query,
    total: sorted.length,
    truncated: result.total > MAX_HITS,
    items: sorted.slice((page - 1) * LISTING_PAGE_SIZE, page * LISTING_PAGE_SIZE),
    categories,
    page,
    pageCount,
  };
}
