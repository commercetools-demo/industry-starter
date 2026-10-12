import type { BuyerContext, CartIssue, CartLineRef, HeldService, Offer, Reason } from '@/lib/types';
import { refersTo } from './refs';
import { makeReason } from './rules';

// Pure (no I/O). Dependencies between offers: required offers, required add-on kinds and negated offers.

/** Every offer a reference points at (a product key can anchor several offers). */
const resolve = (ref: string, offersByKey: Record<string, Offer>): Offer[] => Object.values(offersByKey).filter((offer) => refersTo(ref, offer));

const inCart = (ref: string, lines: CartLineRef[], offersByKey: Record<string, Offer>): boolean =>
  lines.some((line) => {
    const offer = offersByKey[line.offerKey];
    return offer ? refersTo(ref, offer) : line.offerKey === ref;
  });

const isHeld = (ref: string, held: HeldService[], offersByKey: Record<string, Offer>): boolean =>
  held.some((service) => {
    const offer = offersByKey[service.offerKey];
    return offer ? refersTo(ref, offer) : service.offerKey === ref;
  });

export interface MissingOffer {
  /** The offer to add: the first offer the reference resolves to, or null when the catalog has none (fails closed). */
  offer: Offer | null;
  ref: string;
}

/** Required offers of `offer` that are neither in the cart nor held by the customer. */
export function missingRequiredOffers(offer: Offer, lines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): MissingOffer[] {
  return offer.requiresOffers.filter((ref) => !inCart(ref, lines, offersByKey) && !isHeld(ref, held, offersByKey)).map((ref) => ({ ref, offer: resolve(ref, offersByKey)[0] ?? null }));
}

const requiredReason = (offer: Offer, missing: MissingOffer): Reason =>
  makeReason('REQUIRED_OFFER_MISSING', { candidateName: offer.name, requiredName: missing.offer?.name ?? missing.ref }, [offer.key, ...(missing.offer ? [missing.offer.key] : [])]);

/** Add time: the reasons the candidate cannot be added yet (empty when every required offer is present or held). */
export function requiredOfferReasons(candidate: Offer, lines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): { reasons: Reason[]; missing: MissingOffer[] } {
  const missing = missingRequiredOffers(candidate, lines, held, offersByKey);
  return { reasons: missing.map((entry) => requiredReason(candidate, entry)), missing };
}

/** Read time: a line whose required offer is no longer there is a blocking issue; removing the line resolves it. */
export function revalidateRequiredOffers(lines: CartLineRef[], buyer: Pick<BuyerContext, 'held'>, offersByKey: Record<string, Offer>): CartIssue[] {
  return lines.flatMap((line) => {
    const offer = offersByKey[line.offerKey];
    if (!offer || offer.requiresOffers.length === 0) return [];
    const missing = missingRequiredOffers(offer, lines, buyer.held, offersByKey);
    return missing.length === 0 ? [] : [{ lineItemId: line.lineItemId, offerKey: line.offerKey, blocking: true as const, resolution: 'remove' as const, reasons: missing.map((entry) => requiredReason(offer, entry)) }];
  });
}

/** The kinds a plan line has covered: attached add-on or equipment lines, and what the plan includes. */
function coveredKinds(plan: Offer, planLine: CartLineRef, lines: CartLineRef[], offersByKey: Record<string, Offer>): Set<string> {
  const kinds = new Set<string>();
  const note = (offer: Offer | undefined): void => {
    if (!offer) return;
    if (offer.kind === 'equipment') kinds.add('equipment');
    if (offer.facts?.kind === 'addon') kinds.add(offer.facts.addonKind);
  };
  for (const line of lines) if (line.parentLineItemId === planLine.lineItemId) note(offersByKey[line.offerKey]);
  for (const ref of plan.includedOffers) for (const offer of resolve(ref, offersByKey)) note(offer);
  return kinds;
}

/** A plan's required add-on kinds the cart does not cover yet, in the plan's order. */
export function missingAddonKinds(plan: Offer, planLine: CartLineRef, lines: CartLineRef[], offersByKey: Record<string, Offer>): string[] {
  if (plan.facts?.kind !== 'plan') return [];
  const covered = coveredKinds(plan, planLine, lines, offersByKey);
  return plan.facts.requiredAddonKinds.filter((kind) => !covered.has(kind));
}

/** Read time: one blocking issue per plan line missing a required kind; the buyer chooses an option (never removed automatically). */
export function revalidateRequiredAddonKinds(lines: CartLineRef[], offersByKey: Record<string, Offer>): CartIssue[] {
  return lines.flatMap((line) => {
    const plan = offersByKey[line.offerKey];
    if (!plan || (plan.kind !== 'base-package' && plan.kind !== 'bundle')) return [];
    const missing = missingAddonKinds(plan, line, lines, offersByKey);
    return missing.length === 0
      ? []
      : [{ lineItemId: line.lineItemId, offerKey: line.offerKey, blocking: true as const, resolution: 'choose-equipment' as const, reasons: missing.map((kind) => makeReason('REQUIRED_ADDON_KIND_MISSING', { planName: plan.name, kind }, [plan.key])) }];
  });
}

/** Cart lines of offers the candidate negates (it replaces them), or that negate the candidate (symmetric: the buyer chooses). */
export interface NegatedLine {
  line: CartLineRef;
  offer: Offer;
  declaredBy: 'candidate' | 'other';
}
export function negatedLines(candidate: Offer, lines: CartLineRef[], offersByKey: Record<string, Offer>): NegatedLine[] {
  return lines.flatMap((line): NegatedLine[] => {
    const offer = offersByKey[line.offerKey];
    if (!offer || offer.key === candidate.key) return [];
    if (candidate.negatesOffers.some((ref) => refersTo(ref, offer))) return [{ line, offer, declaredBy: 'candidate' as const }];
    if (offer.negatesOffers.some((ref) => refersTo(ref, candidate))) return [{ line, offer, declaredBy: 'other' as const }];
    return [];
  });
}

/** Read time: both sides of a negation are in the cart (the catalog changed). Reported on the later line; nothing is removed here. */
export function revalidateNegations(lines: CartLineRef[], offersByKey: Record<string, Offer>): CartIssue[] {
  const issues: CartIssue[] = [];
  lines.forEach((line, index) => {
    const offer = offersByKey[line.offerKey];
    if (!offer) return;
    const earlier = lines.slice(0, index).flatMap((previous) => {
      const other = offersByKey[previous.offerKey];
      if (!other || other.key === offer.key) return [];
      return offer.negatesOffers.some((ref) => refersTo(ref, other)) || other.negatesOffers.some((ref) => refersTo(ref, offer)) ? [other] : [];
    });
    if (earlier.length > 0) {
      issues.push({ lineItemId: line.lineItemId, offerKey: line.offerKey, blocking: true, resolution: 'replace', reasons: earlier.map((other) => makeReason('NEGATED_OFFER_CONFLICT', { candidateName: offer.name, otherName: other.name }, [offer.key, other.key])) });
    }
  });
  return issues;
}
