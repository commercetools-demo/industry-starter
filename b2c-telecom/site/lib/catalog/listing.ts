import { CHIP_PREDICATES, CHIPS_BY_CATEGORY, DEFAULT_CHIPS, LISTING_PAGE_SIZE } from '@/lib/config/facets';
import { getPriceBands, inBand } from '@/lib/config/price-bands';
import type { Category, ListingQuery, ListingResult, Offer } from '@/lib/types';

/** The headline amount a card shows: monthly when there is one, else the one-time amount (minor units). */
export function headlineAmount(offer: Offer): number | undefined {
  return offer.headline.recurring?.centAmount ?? offer.headline.oneTime?.centAmount;
}

function rootKeyOf(categoryKey: string, roots: Category[]): string {
  for (const root of roots) {
    const stack: Category[] = [root];
    while (stack.length > 0) {
      const node = stack.pop() as Category;
      if (node.key === categoryKey) return root.key;
      stack.push(...node.children);
    }
  }
  return categoryKey;
}

/** Chip ids for a category (a child category uses the chips of its root). */
export function chipsFor(categoryKey: string, roots: Category[]): readonly string[] {
  return CHIPS_BY_CATEGORY[categoryKey] ?? CHIPS_BY_CATEGORY[rootKeyOf(categoryKey, roots)] ?? DEFAULT_CHIPS;
}

function compareOffers(sort: NonNullable<ListingQuery['sort']>) {
  return (a: Offer, b: Offer): number => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    // Offers with a monthly headline first, one-time-only offers after them, in both directions.
    const groupA = a.headline.recurring ? 0 : 1;
    const groupB = b.headline.recurring ? 0 : 1;
    if (groupA !== groupB) return groupA - groupB;
    const amountA = headlineAmount(a) ?? Number.MAX_SAFE_INTEGER;
    const amountB = headlineAmount(b) ?? Number.MAX_SAFE_INTEGER;
    if (amountA !== amountB) return sort === 'price-asc' ? amountA - amountB : amountB - amountA;
    return a.name.localeCompare(b.name);
  };
}

/**
 * Chip, price band, sort and pagination over the offers of one category (and its descendants), in memory.
 * Chip counts are over the whole category; band counts are over the offers the chip keeps.
 */
export function buildListing(offers: Offer[], categoryKey: string, query: ListingQuery, roots: Category[]): ListingResult {
  const chipIds = chipsFor(categoryKey, roots);
  const chip = query.chip && chipIds.includes(query.chip) ? query.chip : 'all';
  const first = offers[0];
  const currency = first?.headline.recurring?.currencyCode ?? first?.headline.oneTime?.currencyCode ?? 'USD';
  const bands = getPriceBands(currency);
  const band = bands.find((candidate) => candidate.id === query.band);
  const pageSize = Math.max(1, Math.floor(query.pageSize ?? LISTING_PAGE_SIZE));

  const chipMatches = offers.filter(CHIP_PREDICATES[chip] ?? CHIP_PREDICATES.all);
  const matching = band ? chipMatches.filter((offer) => inBand(band, headlineAmount(offer) ?? -1)) : chipMatches;
  const sorted = [...matching].sort(compareOffers(query.sort ?? 'price-asc'));

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pageCount);
  const base = {
    chips: chipIds.map((id) => ({ id, count: offers.filter(CHIP_PREDICATES[id] ?? CHIP_PREDICATES.all).length })),
    bands: bands.map((candidate) => ({ id: candidate.id, count: chipMatches.filter((offer) => inBand(candidate, headlineAmount(offer) ?? -1)).length })),
    pageSize,
  };
  if (total === 0) {
    return {
      ...base,
      offers: [],
      total: 0,
      page: 1,
      pageCount: 1,
      empty: offers.length === 0 ? 'no-offers' : 'no-match',
      recoveryLinks: roots.map((root) => ({ key: root.key, name: root.name, slug: root.slug })),
    };
  }
  return { ...base, offers: sorted.slice((page - 1) * pageSize, page * pageSize), total, page, pageCount };
}
