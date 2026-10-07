import { CHIP_PREDICATES, LISTING_PAGE_SIZE } from '@/lib/config/facets';
import { buildListing, chipsFor } from '@/lib/catalog/listing';
import type { Category, ListingParams, ListingResult, Offer } from '@/lib/types';

export interface ListingState {
  result: ListingResult;
  /** The chip that is really applied (an `offer` anchor can drop the one in the URL). */
  filter: string | null;
  /** The offer to scroll to and mark; only an offer this listing shows. */
  highlightKey: string | null;
  /** Chip ids of this listing (H: a child category uses its root's chips). */
  chipIds: readonly string[];
}

/** The page (1-based) on which `offerKey` sits for this chip and sort; 1 when the offer is not in the list. */
export function pageContaining(offers: Offer[], categoryKey: string, roots: Category[], params: Pick<ListingParams, 'filter' | 'sort'>, offerKey: string): number {
  const everything = buildListing(offers, categoryKey, { chip: params.filter ?? 'all', sort: params.sort, pageSize: Math.max(1, offers.length) }, roots).offers;
  const index = everything.findIndex((offer) => offer.key === offerKey);
  return index < 0 ? 1 : Math.floor(index / LISTING_PAGE_SIZE) + 1;
}

/**
 * Filter, sort and page of one listing (H's `buildListing`) plus the canonical-offer rules: an offer anchored with `?offer=` that the
 * chip would hide drops the chip, and without an explicit page the page that holds the offer is shown. A page past the end is
 * clamped by `buildListing`, so the result always has the last page that has results.
 */
export function resolveListingState(input: { offers: Offer[]; categoryKey: string; roots: Category[]; params: ListingParams }): ListingState {
  const { offers, categoryKey, roots, params } = input;
  const chipIds = chipsFor(categoryKey, roots);
  const anchored = params.offer === null ? undefined : offers.find((offer) => offer.key === params.offer);
  let filter = params.filter;
  if (anchored && filter && !(CHIP_PREDICATES[filter] ?? CHIP_PREDICATES.all)(anchored)) filter = null;
  let page = params.page;
  if (anchored && page === 1) page = pageContaining(offers, categoryKey, roots, { filter, sort: params.sort }, anchored.key);
  const result = buildListing(offers, categoryKey, { chip: filter ?? 'all', sort: params.sort, page, pageSize: LISTING_PAGE_SIZE }, roots);
  return { result, filter, highlightKey: anchored?.key ?? null, chipIds };
}
