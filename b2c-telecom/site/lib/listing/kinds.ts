import type { ListingKind, Offer } from '@/lib/types';

const PLAN_CATEGORIES: ReadonlySet<string> = new Set(['malva-cat-cable-internet', 'malva-cat-home-wireless', 'malva-cat-phone-plans']);
const ADDON_CATEGORIES: ReadonlySet<string> = new Set(['malva-cat-add-ons', 'malva-cat-streaming', 'malva-cat-protection', 'malva-cat-equipment']);
const DEVICE_CATEGORY = 'malva-cat-devices';

/** Which cards a category shows. A category added later in commercetools is classified by what its offers are. */
export function listingKindForCategory(categoryKey: string, offers: readonly Offer[]): ListingKind {
  if (PLAN_CATEGORIES.has(categoryKey)) return 'plans';
  if (ADDON_CATEGORIES.has(categoryKey)) return 'addons';
  if (categoryKey === DEVICE_CATEGORY) return 'devices';
  if (offers.length > 0 && offers.every((offer) => offer.kind === 'device')) return 'devices';
  if (offers.length > 0 && offers.every((offer) => offer.kind === 'base-package' || offer.kind === 'bundle')) return 'plans';
  return 'addons';
}

/** The noun of "N plans" / "N add-ons" / "N items": equipment-only listings count items. */
export type CountNoun = 'plans' | 'addons' | 'items' | 'devices';
export function countNounFor(kind: ListingKind, offers: readonly Offer[]): CountNoun {
  if (kind === 'plans') return 'plans';
  if (kind === 'devices') return 'devices';
  return offers.length > 0 && offers.every((offer) => offer.kind === 'equipment') ? 'items' : 'addons';
}
