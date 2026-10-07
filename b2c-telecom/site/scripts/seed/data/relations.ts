// Derived relations between offers (pure, unit-tested): conflicts, included add-ons and the J exception lists.
import { OFFER_WIRING, wiringOf } from './offers/wiring';

const HOME_INTERNET = ['cable', 'fixed-wireless'];

/**
 * Conflicts are symmetric (a in conflicts(b) iff b in conflicts(a)): every home-internet offer conflicts with every
 * other home-internet offer, so a buyer holds at most one. Phone offers conflict with nothing (several lines, D-014).
 */
export function conflictsOf(offerKey: string): string[] {
  const self = wiringOf(offerKey);
  if (!HOME_INTERNET.includes(self.family)) return [];
  return OFFER_WIRING.filter((w) => HOME_INTERNET.includes(w.family) && w.key !== offerKey).map((w) => w.key);
}

export function includedOffersOf(offerKey: string): string[] {
  return [...wiringOf(offerKey).included];
}

/** Anchor product keys of the included add-on offers (must equal `included-addons` of the anchor plan). */
export function includedAddonProductsOf(offerKey: string): string[] {
  return includedOffersOf(offerKey)
    .map(wiringOf)
    .filter((w) => w.kind === 'addon')
    .map((w) => w.anchor);
}

/**
 * Positive exceptions (J): add-ons that are compatible with this offer although the add-on's attributes say otherwise.
 * Netflix is internet-only by attributes and is allowed on Unlimited Max.
 */
export const COMPATIBLE_ADDON_EXCEPTIONS: Record<string, string[]> = {
  'malva-offer-phone-unlimited-max': ['malva-offer-netflix'],
};

export function compatibleAddonsOf(offerKey: string): string[] {
  return [...(COMPATIBLE_ADDON_EXCEPTIONS[offerKey] ?? [])];
}

/** Negative exception (J): the AX3000 router cannot be combined with Air Lite. Lives on the equipment product. */
export const INCOMPATIBLE_EQUIPMENT: Record<string, string[]> = {
  'malva-router-ax3000': ['malva-offer-wireless-lite'],
};
