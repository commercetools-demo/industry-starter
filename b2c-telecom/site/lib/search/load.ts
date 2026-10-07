import 'server-only';
import { marketFromLocale } from '@/lib/config/markets';
import { getCategoryTree } from '@/lib/ct/categories';
import { getSearchLanguages, searchOfferHits } from '@/lib/ct/search';
import { getVisibleOffers } from '@/lib/ct/visible-offers';
import { flattenTree } from '@/lib/mappers/category';
import type { Category, Locale, SearchView } from '@/lib/types';
import { parseSearchParams, type RawSearchParams, type SearchParams } from './params';
import { runSearch } from './run';

export interface LoadedSearch {
  params: SearchParams;
  view: SearchView;
  tree: Category[];
}

/** The one read behind the search page and `/api/search`: URL parameters in, the view of the page out. */
export async function loadSearch(locale: Locale, raw: RawSearchParams): Promise<LoadedSearch> {
  const market = marketFromLocale(locale);
  const tree = await getCategoryTree(locale);
  const params = parseSearchParams(raw, flattenTree(tree).map((category) => category.key));
  const view = await runSearch(params, {
    locale,
    tree,
    getLanguages: getSearchLanguages,
    searchOfferHits,
    getOffers: async () => (await getVisibleOffers(market)).offers,
  });
  return { params, view, tree };
}
