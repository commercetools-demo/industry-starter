import { UPSELL_FEATURED_OFFER_KEYS } from '@/lib/config/listing';
import type { Offer } from '@/lib/types';

/**
 * The two names the upsell band shows ("Spotify and Apple TV+ and more can be added to any plan"): the featured streaming add-ons
 * first (config), then the other streaming add-ons in listing order. Fewer than two exist: as many as there are.
 */
export function upsellNames(addons: readonly Offer[], count = 2): string[] {
  const streaming = addons.filter((offer) => offer.kind === 'addon' && offer.facts?.kind === 'addon' && offer.facts.addonKind === 'streaming');
  const featured = UPSELL_FEATURED_OFFER_KEYS.flatMap((key) => streaming.find((offer) => offer.key === key) ?? []);
  const others = streaming.filter((offer) => !featured.includes(offer));
  return [...featured, ...others].slice(0, count).map((offer) => offer.name);
}
