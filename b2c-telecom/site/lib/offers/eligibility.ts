import { CUSTOMER_TYPE_PRIORITY } from '@/lib/config/eligibility';
import type { BuyerContext, CartIssue, CartLineRef, CustomerType, Offer, PlanFamily, Reason, ServiceLocation } from '@/lib/types';
import { makeReason } from './rules';

export { describeAvailability } from './serviceability';

// Pure (no I/O): one function decides "may this buyer see and buy this offer?" for browse, search, direct links, add and
// checkout. An ineligible offer is ABSENT (not refused with an error page) and there is no override (D-022).

/** Is the family served at the location? `internet` needs cable or fixed wireless, `phone` needs mobile. */
function familyServed(location: ServiceLocation, family: PlanFamily): boolean {
  return family === 'internet' ? location.served.cable || location.served['fixed-wireless'] : location.served.mobile;
}

function notServiceable(offer: Offer, location: ServiceLocation): boolean {
  const facts = offer.facts;
  if (!facts) return false;
  switch (facts.kind) {
    case 'plan':
      return location.served[facts.technology] === false;
    case 'addon':
      // Empty families is bad data handled by J; it is not gated here.
      return facts.appliesToFamilies.length > 0 && facts.appliesToFamilies.every((family) => !familyServed(location, family));
    case 'equipment':
      return !familyServed(location, 'internet');
    case 'device':
      return !familyServed(location, 'phone');
  }
}

/** All failing rules are collected; the first reason is the primary one. Order: audience, existing customer, channel, schedule, serviceability. */
export function evaluateEligibility(offer: Offer, buyer: BuyerContext): { eligible: boolean; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const params = { offerName: offer.name };
  const keys = [offer.key];

  if (offer.audience.length > 0 && !offer.audience.includes(buyer.customerType)) {
    reasons.push(makeReason('NOT_ELIGIBLE_AUDIENCE', params, keys));
  }
  if (offer.existingCustomer === 'existing' && !buyer.isExistingCustomer) {
    reasons.push(makeReason('NOT_ELIGIBLE_EXISTING_CUSTOMER', { ...params, rule: 'existing' }, keys));
  } else if (offer.existingCustomer === 'new' && buyer.isExistingCustomer) {
    reasons.push(makeReason('NOT_ELIGIBLE_EXISTING_CUSTOMER', { ...params, rule: 'new' }, keys));
  }
  if (offer.channels.length > 0 && !offer.channels.includes(buyer.channel)) {
    reasons.push(makeReason('NOT_ELIGIBLE_CHANNEL', { ...params, channel: buyer.channel, allowed: offer.channels.join(', ') }, keys));
  }
  const now = buyer.now.getTime();
  if (offer.startTime !== undefined && now < Date.parse(offer.startTime)) reasons.push(makeReason('NOT_STARTED', params, keys));
  if (offer.endTime !== undefined && now >= Date.parse(offer.endTime)) reasons.push(makeReason('ENDED', params, keys));
  // No location means "not gated": the catalog is shown with a prompt for the ZIP.
  if (buyer.location && notServiceable(offer, buyer.location)) {
    reasons.push(makeReason('NOT_SERVICEABLE', { ...params, postalCode: buyer.location.postalCode }, keys));
  }
  return { eligible: reasons.length === 0, reasons };
}

export function filterEligible(offers: Offer[], buyer: BuyerContext): Offer[] {
  return offers.filter((offer) => evaluateEligibility(offer, buyer).eligible);
}

/**
 * A direct link, search hit or bundle prompt: an ineligible offer resolves to nothing visible and the reason that failed is
 * recorded. An unknown key reads `OFFER_NOT_FOUND`.
 */
export function resolveVisibleOffer(offersByKey: Record<string, Offer>, key: string, buyer: BuyerContext): { offer: Offer | null; reasons: Reason[] } {
  const offer = offersByKey[key];
  if (!offer) return { offer: null, reasons: [makeReason('OFFER_NOT_FOUND', {}, [key])] };
  const { eligible, reasons } = evaluateEligibility(offer, buyer);
  return eligible ? { offer, reasons: [] } : { offer: null, reasons };
}

/** `employee` wins over `small-business` wins over `consumer`; none of them is `consumer`. */
export function customerTypeFromGroups(groupKeys: string[]): CustomerType {
  return CUSTOMER_TYPE_PRIORITY.find((type) => groupKeys.includes(type)) ?? 'consumer';
}

/**
 * Eligibility lost between add and checkout, or a changed location: the line is KEPT and flagged blocking with the reason
 * (never dropped or repriced); the buyer removes it. One issue per line, cart order.
 */
export function revalidateCartEligibility(lines: CartLineRef[], offersByKey: Record<string, Offer>, buyer: BuyerContext): CartIssue[] {
  return lines.flatMap((line): CartIssue[] => {
    const offer = offersByKey[line.offerKey];
    if (!offer) {
      return [{ lineItemId: line.lineItemId, offerKey: line.offerKey, blocking: true, resolution: 'remove', reasons: [makeReason('OFFER_NOT_FOUND', {}, [line.offerKey])] }];
    }
    const { eligible, reasons } = evaluateEligibility(offer, buyer);
    return eligible ? [] : [{ lineItemId: line.lineItemId, offerKey: line.offerKey, blocking: true, resolution: 'remove', reasons }];
  });
}
