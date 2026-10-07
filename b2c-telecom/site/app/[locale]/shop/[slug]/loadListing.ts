import { cache } from 'react';
import { marketFromLocale } from '@/lib/config/markets';
import { getCategoryBySlug, getCategoryTree } from '@/lib/ct/categories';
import { getVisibleOffers, getVisibleOffersInCategory, type VisibleOffers } from '@/lib/ct/visible-offers';
import { chipsFor } from '@/lib/catalog/listing';
import { listingKindForCategory } from '@/lib/listing/kinds';
import { offerPath, primaryCategoryKey } from '@/lib/listing/links';
import { parseListingParams } from '@/lib/listing/params';
import { resolveListingState, type ListingState } from '@/lib/listing/state';
import { dedupeByAnchors } from '@/lib/listing/visibility';
import type { Category, ListingKind, ListingParams, Locale, Offer } from '@/lib/types';

export type ListingLoad =
  | { type: 'not-found' }
  /** Same page, the canonical address: another locale's slug, or an `?offer=` whose primary category is another one. `href` has no locale prefix. */
  | { type: 'redirect'; href: string }
  | {
      type: 'ok';
      category: Category;
      tree: Category[];
      kind: ListingKind;
      params: ListingParams;
      /** Visible to this buyer and de-duplicated: what the listing counts and pages over. */
      listed: Offer[];
      /** Everything this buyer may see (the pool of add-ons, equipment and plans the cards use). */
      pool: Offer[];
      state: ListingState;
      availability: VisibleOffers['availability'];
      postalCode: string | undefined;
    };

/**
 * Everything the page and its metadata need, read once per request and listing (`cache` keyed by primitives). Pure decisions only: a
 * redirect or a 404 is RETURNED and the page performs it (`redirect()` and `notFound()` throw and must never sit inside a try/catch).
 */
export const loadListing = cache(async (locale: Locale, slug: string, query: string): Promise<ListingLoad> => {
  const raw = Object.fromEntries(new URLSearchParams(query));
  const match = await getCategoryBySlug(slug, locale);
  if (!match) return { type: 'not-found' };
  const { category, matchedLocale } = match;
  const search = query === '' ? '' : `?${query}`;
  if (matchedLocale !== locale) return { type: 'redirect', href: `/shop/${category.slugs[locale] ?? category.slug}${search}` };

  const market = marketFromLocale(locale);
  const [tree, visible, everything] = await Promise.all([getCategoryTree(locale), getVisibleOffersInCategory(category.key, market), getVisibleOffers(market)]);
  const params = parseListingParams(raw, chipsFor(category.key, tree));

  // One offer, one canonical link: the offer lives at the listing of its FIRST category.
  const anchored = params.offer === null ? undefined : everything.offers.find((offer) => offer.key === params.offer);
  if (anchored && primaryCategoryKey(anchored) !== category.key) {
    const canonical = offerPath(anchored, locale, tree);
    if (canonical !== undefined) return { type: 'redirect', href: canonical };
  }

  const effective: ListingParams = { ...params, offer: anchored ? params.offer : null };
  const listed = dedupeByAnchors(visible.offers, effective.offer);
  const kind = listingKindForCategory(category.key, listed);
  const state = resolveListingState({ offers: listed, categoryKey: category.key, roots: tree, params: effective });
  return {
    type: 'ok',
    category,
    tree,
    kind,
    params: effective,
    listed,
    pool: everything.offers,
    state,
    availability: visible.availability,
    postalCode: visible.buyer.location?.postalCode,
  };
});
