import type { CompatVerdict, Offer, PlanFamily, Reason, ReasonCode } from '@/lib/types';
import { refersTo } from './refs';

/** Equipment is sold for internet plans only. */
const EQUIPMENT_FAMILIES: readonly PlanFamily[] = ['internet'];

export function makeReason(code: ReasonCode, params: Reason['params'], offerKeys: string[]): Reason {
  return { code, messageKey: `offers.reason.${code}`, params, offerKeys };
}

const unavailable = (reasons: Reason[]): CompatVerdict => ({ status: 'unavailable', reasons });

/**
 * Does `candidate` (add-on or equipment) fit `plan`? Pure.
 *
 * Planner correction: `compatible-addons` / `compatible-equipment` on the plan offer are POSITIVE EXCEPTIONS (spec
 * "exceptions only, computed rules win unless listed"; the seed lists Netflix on Unlimited Max although Netflix is
 * internet-only). A listed candidate skips the family, technology and speed rules; a declared incompatibility and an
 * included extra still win. Failing rules are all collected; the first reason is the primary one.
 */
export function evaluateCandidate(plan: Offer, candidate: Offer): CompatVerdict {
  const planFacts = plan.facts;
  const facts = candidate.facts;
  const keys = [plan.key, candidate.key];
  if (planFacts?.kind !== 'plan' || (facts?.kind !== 'addon' && facts?.kind !== 'equipment')) {
    return unavailable([makeReason('CATALOG_DATA_INCOMPLETE', { planName: plan.name, candidateName: candidate.name }, keys)]);
  }
  const params = { planName: plan.name, candidateName: candidate.name };

  // 1. Already included: stop.
  if (plan.includedOffers.some((ref) => refersTo(ref, candidate))) {
    return { status: 'included', reasons: [makeReason('ALREADY_INCLUDED', params, keys)] };
  }

  const reasons: Reason[] = [];
  // 2. Declared exception (equipment lists the plans it cannot be combined with).
  if (facts.kind === 'equipment' && facts.incompatibleWith.some((ref) => refersTo(ref, plan))) {
    reasons.push(makeReason('DECLARED_INCOMPATIBLE', params, keys));
  }

  // 3. Positive exception: skips the computed rules 4 to 6.
  const exceptions = facts.kind === 'addon' ? plan.compatibleAddons : plan.compatibleEquipment;
  if (exceptions.some((ref) => refersTo(ref, candidate))) return reasons.length > 0 ? unavailable(reasons) : { status: 'allowed', reasons: [] };

  // 4. Family. An empty set on an add-on is bad data and fails closed.
  const families = facts.kind === 'addon' ? facts.appliesToFamilies : EQUIPMENT_FAMILIES;
  if (families.length === 0) {
    reasons.push(makeReason('CATALOG_DATA_INCOMPLETE', params, keys));
  } else if (!families.includes(planFacts.family)) {
    // Technology and speed are meaningless for another family: the family reason is the only one.
    reasons.push(makeReason('FAMILY_MISMATCH', params, keys));
    return unavailable(reasons);
  }

  // 5. Technology.
  const technologies = facts.kind === 'addon' ? facts.appliesToTechnologies : facts.supportedTechnologies;
  if (technologies.length === 0 && facts.kind === 'equipment') {
    reasons.push(makeReason('CATALOG_DATA_INCOMPLETE', params, keys));
  } else if (technologies.length > 0 && !technologies.includes(planFacts.technology)) {
    reasons.push(makeReason('TECHNOLOGY_MISMATCH', params, keys));
  }

  // 6. Speed (equal is allowed).
  if (facts.kind === 'equipment') {
    const max = facts.maxDownstreamMbps;
    const needed = planFacts.downstreamMbps;
    if (max === undefined || needed === undefined) reasons.push(makeReason('CATALOG_DATA_INCOMPLETE', params, keys));
    else if (max < needed) reasons.push(makeReason('SPEED_TOO_LOW', { ...params, max, needed }, keys));
  }

  return reasons.length > 0 ? unavailable(reasons) : { status: 'allowed', reasons: [] };
}

/** Symmetric: either side naming the other is a conflict (K builds cart-wide and held-service logic on top). */
export function conflictBetween(a: Offer, b: Offer): boolean {
  return a.conflictsWith.some((ref) => refersTo(ref, b)) || b.conflictsWith.some((ref) => refersTo(ref, a));
}
