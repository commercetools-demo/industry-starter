import { CHIP_PREDICATES } from '@/lib/config/facets';
import type { Offer } from '@/lib/types';

// H owns the chip ids and their predicates (D-017, `lib/config/facets.ts`, applied by `buildListing`). This file adds what the listing
// page needs on top: the chip of one plan card, and a generic "several facet groups at once" filter. The shipped design has ONE group
// (the chip bar); the generic form keeps a second group (price, say) a data change instead of a rewrite.

export interface FacetGroup {
  /** The query parameter of the group. */
  id: string;
  /** One predicate per option id. */
  options: Readonly<Record<string, (offer: Offer) => boolean>>;
}

/** The chip bar as a facet group (`filter`). */
export const CHIP_GROUP: FacetGroup = { id: 'filter', options: CHIP_PREDICATES };

/** Keeps the offers that pass every group that has a selection; a selection that is not an option of its group is ignored. */
export function applyFacets(offers: Offer[], groups: readonly FacetGroup[], selection: Readonly<Record<string, string | null | undefined>>): Offer[] {
  return groups.reduce((kept, group) => {
    const chosen = selection[group.id];
    const predicate = chosen ? group.options[chosen] : undefined;
    return predicate ? kept.filter(predicate) : kept;
  }, offers);
}

/** How many of `offers` each option of the group keeps (chips with 0 are shown disabled). */
export function facetCounts(offers: Offer[], group: FacetGroup): { id: string; count: number }[] {
  return Object.entries(group.options).map(([id, predicate]) => ({ id, count: offers.filter(predicate).length }));
}

const CHIPS_OF_PLAN_FAMILY = {
  phone: ['unlimited', 'data-capped'],
  cable: ['up-to-500', '1-gbps'],
  'fixed-wireless': ['5g', 'lte'],
} as const;

/**
 * The chip a plan belongs to: the card's own label ("5G", "Up to 500 Mbps", "Unlimited"), derived from attributes and never from a
 * hand-kept tag text (D-017). null for anything that is not a plan or has no matching chip.
 */
export function planChipId(offer: Offer): string | null {
  const facts = offer.facts;
  if (facts?.kind !== 'plan') return null;
  const chips = facts.family === 'phone' ? CHIPS_OF_PLAN_FAMILY.phone : CHIPS_OF_PLAN_FAMILY[facts.technology === 'fixed-wireless' ? 'fixed-wireless' : 'cable'];
  return chips.find((id) => CHIP_PREDICATES[id]?.(offer)) ?? null;
}

/** Chips that filter anything: the chip group is hidden unless at least two options (besides All) have offers. */
export function chipGroupVisible(chips: readonly { id: string; count: number }[]): boolean {
  return chips.filter((chip) => chip.id !== 'all' && chip.count > 0).length >= 2;
}
