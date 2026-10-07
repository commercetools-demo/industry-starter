import type { Offer } from '@/lib/types';

const OFFER_PREFIX = 'malva-offer-';

/** `malva-appletv` becomes `malva-offer-appletv`. */
export const offerKeyForProduct = (productKey: string): string => `${OFFER_PREFIX}${productKey.replace(/^malva-/, '')}`;

/**
 * The only place that compares catalog references. Attributes hold offer keys (`malva-offer-appletv`), product keys
 * (`malva-appletv`) or SKUs. An offer key matches that one offer only; a product key matches every offer that anchors the
 * product; a SKU matches the offer owning that variant.
 */
export function refersTo(ref: string, offer: Pick<Offer, 'key' | 'anchors' | 'variants'>): boolean {
  if (ref.startsWith(OFFER_PREFIX)) return ref === offer.key;
  return offer.anchors.includes(ref) || offer.variants.some((variant) => variant.sku === ref);
}
