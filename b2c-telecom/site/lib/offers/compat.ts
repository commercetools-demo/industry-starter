import type { CandidateEntry, CartLineRef, CompatVerdict, Offer, ReplaceTarget, VerdictStatus } from '@/lib/types';
import { dependentsOf, planLinesOf } from './addons';
import { defaultEquipment } from './equipment';
import { refersTo } from './refs';
import { conflictBetween, evaluateCandidate, makeReason } from './rules';

export { conflictBetween, evaluateCandidate };

export interface AdditionInput {
  candidate: Offer;
  /** Current cart lines (empty in card mode). */
  cart: CartLineRef[];
  /** Card mode: evaluate against this plan instead of the cart. */
  planOffer?: Offer;
  requestedParentLineItemId?: string;
  /** The whole cached catalog by key. */
  offersByKey: Record<string, Offer>;
}

const SEVERITY: Record<VerdictStatus, number> = { allowed: 0, included: 1, unavailable: 2 };

/** K uses it to add its own verdicts: reasons concatenated, status = the worst (unavailable > included > allowed). */
export function mergeVerdicts(a: CompatVerdict, b: CompatVerdict): CompatVerdict {
  const status = SEVERITY[a.status] >= SEVERITY[b.status] ? a.status : b.status;
  const replaces = [...(a.replaces ?? []), ...(b.replaces ?? [])];
  const candidateParents = a.candidateParents ?? b.candidateParents;
  const parentLineItemId = a.parentLineItemId ?? b.parentLineItemId;
  const requiredEquipment = a.requiredEquipment ?? b.requiredEquipment;
  return {
    status,
    reasons: [...a.reasons, ...b.reasons],
    ...(parentLineItemId === undefined ? {} : { parentLineItemId }),
    ...(candidateParents === undefined ? {} : { candidateParents }),
    ...(replaces.length > 0 ? { replaces } : {}),
    ...(requiredEquipment === undefined ? {} : { requiredEquipment }),
  };
}

function planCandidateVerdict(candidate: Offer, cart: CartLineRef[], offersByKey: Record<string, Offer>): CompatVerdict {
  const reasons: CompatVerdict['reasons'] = [];
  const replaces: ReplaceTarget[] = [];
  for (const line of cart) {
    // The same offer again is a quantity change, which the cart endpoint decides.
    if (line.offerKey === candidate.key) continue;
    const other = offersByKey[line.offerKey];
    if (!other || !conflictBetween(candidate, other)) continue;
    reasons.push(makeReason('EXCLUSIVE_CONFLICT', { candidateName: candidate.name, otherName: other.name }, [candidate.key, other.key]));
    replaces.push({ lineItemId: line.lineItemId, offerKey: other.key, offerName: other.name });
  }
  const equipmentOffers = Object.values(offersByKey).filter((offer) => offer.kind === 'equipment');
  const { selections, unfulfillable } = defaultEquipment(candidate, equipmentOffers);
  for (const kind of unfulfillable) {
    reasons.push(makeReason('REQUIRED_EQUIPMENT_MISSING', { planName: candidate.name, kind }, [candidate.key]));
  }
  return {
    status: reasons.length > 0 ? 'unavailable' : 'allowed',
    reasons,
    ...(replaces.length > 0 ? { replaces } : {}),
    requiredEquipment: selections,
  };
}

function cartModeVerdict(input: AdditionInput): CompatVerdict {
  const { candidate, cart, offersByKey, requestedParentLineItemId } = input;
  const planLines = planLinesOf(cart, offersByKey);
  if (planLines.length === 0) return { status: 'unavailable', reasons: [makeReason('PARENT_REQUIRED', {}, [candidate.key])] };

  const verdictOf = (line: CartLineRef): CompatVerdict => {
    const plan = offersByKey[line.offerKey];
    if (!plan) return { status: 'unavailable', reasons: [makeReason('OFFER_NOT_FOUND', {}, [line.offerKey])] };
    const verdict = evaluateCandidate(plan, candidate);
    const attached = dependentsOf(cart, line.lineItemId).some((dependent) => dependent.offerKey === candidate.key);
    if (verdict.status === 'allowed' && attached) {
      return { status: 'unavailable', reasons: [makeReason('ALREADY_ATTACHED', { planName: plan.name }, [plan.key, candidate.key])] };
    }
    return verdict.status === 'allowed' ? { ...verdict, parentLineItemId: line.lineItemId } : verdict;
  };

  if (requestedParentLineItemId !== undefined) {
    const requested = planLines.find((line) => line.lineItemId === requestedParentLineItemId);
    if (!requested) return { status: 'unavailable', reasons: [makeReason('PARENT_REQUIRED', {}, [candidate.key])] };
    return verdictOf(requested);
  }

  const verdicts = planLines.map((line) => ({ line, verdict: verdictOf(line) }));
  const eligible = verdicts.filter((entry) => entry.verdict.status === 'allowed');
  if (eligible.length === 1) return eligible[0].verdict;
  if (eligible.length > 1) {
    return {
      status: 'unavailable',
      reasons: [makeReason('AMBIGUOUS_PARENT', {}, [candidate.key])],
      candidateParents: eligible.map((entry) => entry.line.lineItemId),
    };
  }
  if (verdicts.some((entry) => entry.verdict.status === 'included')) {
    return { status: 'included', reasons: verdicts.find((entry) => entry.verdict.status === 'included')?.verdict.reasons ?? [] };
  }
  return { status: 'unavailable', reasons: verdicts.flatMap((entry) => entry.verdict.reasons) };
}

/** May `candidate` be added? Pure; the cart endpoint (M) calls it before every write and refuses anything but `allowed`. */
export function evaluateAddition(input: AdditionInput): CompatVerdict {
  const { candidate, planOffer, cart, offersByKey } = input;
  if (candidate.kind === 'device') return { status: 'allowed', reasons: [] };
  if (candidate.kind === 'base-package' || candidate.kind === 'bundle') return planCandidateVerdict(candidate, cart, offersByKey);
  if (planOffer) return evaluateCandidate(planOffer, candidate);
  return cartModeVerdict(input);
}

/**
 * The candidates a plan card shows. Add-ons for another plan family are not offered at all; equipment that fails speed or
 * technology is returned `unavailable` with its reason (disabled and explained, never hidden); included ones come back
 * `included`; ones already on the plan come back `ALREADY_ATTACHED`. Input order is kept.
 */
export function buildCandidateList(plan: Offer, candidates: Offer[], attachedKeys: string[] = []): CandidateEntry[] {
  return candidates.flatMap((offer) => {
    const verdict = evaluateCandidate(plan, offer);
    if (verdict.reasons.some((reason) => reason.code === 'FAMILY_MISMATCH')) return [];
    if (verdict.status === 'allowed' && attachedKeys.some((key) => refersTo(key, offer))) {
      return [{ offer, verdict: { status: 'unavailable' as const, reasons: [makeReason('ALREADY_ATTACHED', { planName: plan.name }, [plan.key, offer.key])] } }];
    }
    return [{ offer, verdict }];
  });
}
