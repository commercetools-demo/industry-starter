// The ONLY file of the cart that imports J's (compatibility) and K's (exclusivity, eligibility, revalidation) functions. Pure: no I/O.
// Every failure is ABSOLUTE for buyers (D-022): nothing here takes an override. The route re-runs this on every add, so a card's earlier
// verdict is never trusted.
//
// ADAPTER: M's plan named checkCompatibility/requiredEquipment/revalidateCompatibility/parentCandidates; the real exports are
// J's evaluateAddition (verdict with parentLineItemId, candidateParents, replaces, requiredEquipment) and K's evaluateEligibility,
// exclusivityVerdict, dedupeVerdict and revalidateCart.
import { evaluateAddition, mergeVerdicts } from '@/lib/offers/compat';
import { evaluateEligibility } from '@/lib/offers/eligibility';
import { dedupeVerdict, exclusivityVerdict } from '@/lib/offers/exclusivity';
import { revalidateCart as revalidateRules } from '@/lib/offers/revalidate';
import type { BlockedAdd, BuyerContext, BundleIssue, BundleIssueReason, CartLineRef, CompatVerdict, EquipmentSelection, Offer, Reason } from '@/lib/types';
import { MAX_PHONE_LINES } from '@/lib/config/cart';
import { checkQuantity } from './quantity';

export interface GuardLine extends CartLineRef {
  sku: string;
}

export interface GuardInput {
  candidate: Offer;
  sku: string;
  quantity: number;
  parentLineId?: string | undefined;
  lines: GuardLine[];
  offersByKey: Record<string, Offer>;
  buyer: BuyerContext;
}

export type GuardResult =
  | { allowed: true; parentLineId: string | undefined; equipment: EquipmentSelection[] }
  | { allowed: false; blocked: BlockedAdd; candidateParents?: string[] };

const toReason = (reason: Reason): BundleIssueReason => ({ code: reason.code, messageKey: reason.messageKey, params: reason.params, offerKeys: reason.offerKeys });

const isPlan = (offer: Offer): boolean => offer.kind === 'base-package' || offer.kind === 'bundle';

/** One plan per category: cable, fixed wireless or mobile. */
function planCategory(offer: Offer): string | null {
  return offer.facts?.kind === 'plan' ? offer.facts.technology : null;
}

const blocked = (kind: BlockedAdd['kind'], offer: Offer, reasons: BundleIssueReason[], replace?: BlockedAdd['replace']): GuardResult => ({
  allowed: false,
  blocked: { kind, offerKey: offer.key, reasons, ...(replace ? { replace } : {}) },
});

/** Group 1, M's own rules: quantity limits and one plan per category. */
function ownRules(input: GuardInput): GuardResult | null {
  const { candidate, quantity, lines, offersByKey, sku } = input;
  if (isPlan(candidate)) {
    const category = planCategory(candidate);
    const phone = candidate.facts?.kind === 'plan' && candidate.facts.family === 'phone';
    for (const line of lines) {
      const other = offersByKey[line.offerKey];
      if (!other || !isPlan(other) || planCategory(other) !== category) continue;
      if (other.key === candidate.key && line.sku === sku) {
        // The same plan again: only phone plans take more lines, up to the maximum.
        if (!phone) return { allowed: false, blocked: checkQuantity(candidate, line.quantity + quantity) ?? { kind: 'limit', offerKey: candidate.key, reasons: [] } };
        if (line.quantity + quantity > MAX_PHONE_LINES) {
          const limit = checkQuantity(candidate, line.quantity + quantity);
          if (limit) return { allowed: false, blocked: limit };
        }
        return null;
      }
      return blocked(
        'conflict',
        candidate,
        [{ code: 'ONE_PLAN_PER_CATEGORY', messageKey: 'bundle.blocked.replacePlan', params: { name: candidate.name, otherName: other.name }, offerKeys: [candidate.key, other.key] }],
        { removeLineId: line.lineItemId, removeOfferKey: other.key, removeOfferName: other.name },
      );
    }
  }
  const limit = checkQuantity(candidate, quantity);
  return limit ? { allowed: false, blocked: limit } : null;
}

function fromVerdict(candidate: Offer, verdict: CompatVerdict): GuardResult {
  const reasons = verdict.reasons.map(toReason);
  const codes = new Set(verdict.reasons.map((reason) => reason.code));
  if (codes.has('PARENT_REQUIRED') || codes.has('AMBIGUOUS_PARENT')) {
    return { ...(blocked('invalid', candidate, reasons) as { allowed: false; blocked: BlockedAdd }), ...(verdict.candidateParents ? { candidateParents: verdict.candidateParents } : {}) };
  }
  if (codes.has('EXCLUSIVE_CONFLICT') || codes.has('HELD_SERVICE_CONFLICT')) {
    const target = verdict.replaces?.[0];
    return blocked('conflict', candidate, reasons, target ? { removeLineId: target.lineItemId, removeOfferKey: target.offerKey, removeOfferName: target.offerName } : undefined);
  }
  return blocked('incompatible', candidate, reasons);
}

/**
 * Order of the groups (the first failing group returns ALL its reasons): (1) M rules, kinds `limit` and `conflict`
 * (ONE_PLAN_PER_CATEGORY, with `replace`); (2) K eligibility, kind `ineligible`; (3) K exclusivity and (4) J compatibility,
 * kinds `conflict` (symmetric, with `replace`) and `incompatible`. Stock is checked by the route after the guard (kind `unavailable`).
 */
export function guardAdd(input: GuardInput): GuardResult {
  const { candidate, lines, offersByKey, buyer } = input;
  const own = ownRules(input);
  if (own) return own;

  const eligibility = evaluateEligibility(candidate, buyer);
  if (!eligibility.eligible) return blocked('ineligible', candidate, eligibility.reasons.map(toReason));

  let verdict = evaluateAddition({ candidate, cart: lines, requestedParentLineItemId: input.parentLineId, offersByKey });
  if (isPlan(candidate)) verdict = dedupeVerdict(mergeVerdicts(verdict, exclusivityVerdict(candidate, lines, buyer.held, offersByKey)));
  if (verdict.status !== 'allowed') return fromVerdict(candidate, verdict);
  return { allowed: true, parentLineId: verdict.parentLineItemId, equipment: verdict.requiredEquipment ?? [] };
}

/** Everything wrong with the lines now (J compatibility, K exclusivity, K eligibility), as blocking bundle issues. Run on every cart read. */
export function revalidateLines(input: { lines: GuardLine[]; offersByKey: Record<string, Offer>; buyer: BuyerContext }): BundleIssue[] {
  return revalidateRules(input).map((issue) => ({
    code: issue.reasons[0]?.code ?? 'ISSUE',
    severity: 'blocking' as const,
    lineId: issue.lineItemId,
    offerKey: issue.offerKey,
    resolution: issue.resolution,
    reasons: issue.reasons.map(toReason),
  }));
}
