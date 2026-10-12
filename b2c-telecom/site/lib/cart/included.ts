import { refersTo } from '@/lib/offers/refs';
import type { Offer, OfferVariant } from '@/lib/types';

const isPlan = (offer: Offer): boolean => offer.kind === 'base-package' || offer.kind === 'bundle';

export interface IncludedLine {
  offer: Offer;
  variant: OfferVariant;
}

/**
 * The offers a plan includes that become child lines at price 0 when the plan is added: add-ons and equipment (an included plan, as in a
 * bundle, is listed but is not a child line). The month-to-month (or first) variant is the one carried. `equipment` are the plan's
 * required-equipment lines: an included offer that is already one of them is not added twice.
 */
export function includedLinesOf(plan: Offer, offersByKey: Record<string, Offer>, equipment: readonly IncludedLine[] = []): IncludedLine[] {
  if (!isPlan(plan)) return [];
  return plan.includedOffers.flatMap((ref) => {
    const offer = Object.values(offersByKey).find((entry) => (entry.kind === 'addon' || entry.kind === 'equipment') && refersTo(ref, entry));
    const chosen = offer?.variants.find((entry) => entry.termMonths === 0) ?? offer?.variants[0];
    return offer && chosen && !equipment.some((entry) => entry.offer.key === offer.key) ? [{ offer, variant: chosen }] : [];
  });
}
