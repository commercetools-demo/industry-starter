import type { CartIssue, CartLineRef, CompatVerdict, ConflictFinding, HeldService, Offer, ReplaceTarget } from '@/lib/types';
import { removalPlan } from './addons';
import { refersTo } from './refs';
import { conflictBetween, makeReason } from './rules';

// Pure (no I/O). Mutual exclusion is ABSOLUTE for buyers (D-022): no function here takes an override argument.

function declaredBy(candidate: Offer, other: Offer): ConflictFinding['declaredBy'] {
  const byCandidate = candidate.conflictsWith.some((ref) => refersTo(ref, other));
  const byOther = other.conflictsWith.some((ref) => refersTo(ref, candidate));
  return byCandidate && byOther ? 'both' : byCandidate ? 'candidate' : 'other';
}

/**
 * Every offer in the cart and every held service that cannot coexist with `candidate`. Symmetric: the conflict may be declared
 * on either side (J's `conflictBetween`). An offer never conflicts with itself (same key skipped).
 */
export function findConflicts(candidate: Offer, cartLines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): ConflictFinding[] {
  const findings: ConflictFinding[] = [];
  for (const line of cartLines) {
    if (line.offerKey === candidate.key) continue;
    const other = offersByKey[line.offerKey];
    if (!other || !conflictBetween(candidate, other)) continue;
    findings.push({
      source: 'cart',
      candidateKey: candidate.key,
      otherKey: other.key,
      otherName: other.name,
      lineItemId: line.lineItemId,
      declaredBy: declaredBy(candidate, other),
    });
  }
  for (const service of held) {
    if (service.offerKey === candidate.key) continue;
    const other = offersByKey[service.offerKey];
    if (!other || !conflictBetween(candidate, other)) continue;
    findings.push({
      source: 'held',
      candidateKey: candidate.key,
      otherKey: other.key,
      otherName: other.name,
      reference: service.reference,
      declaredBy: declaredBy(candidate, other),
    });
  }
  return findings;
}

/**
 * No findings: `allowed` with no reasons (non conflicting offers coexist). Cart findings: `EXCLUSIVE_CONFLICT` per finding and one
 * `replaces` entry each (the buyer chooses "Replace X with Y" or "Keep X"; the swap is never automatic). Held findings:
 * `HELD_SERVICE_CONFLICT` and no `replaces` (a held service cannot be removed from the cart). Any finding makes it `unavailable`.
 */
export function exclusivityVerdict(candidate: Offer, cartLines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): CompatVerdict {
  const findings = findConflicts(candidate, cartLines, held, offersByKey);
  if (findings.length === 0) return { status: 'allowed', reasons: [] };
  const replaces: ReplaceTarget[] = [];
  const reasons = findings.map((finding) => {
    const params = { candidateName: candidate.name, otherName: finding.otherName };
    if (finding.source === 'cart') {
      replaces.push({ lineItemId: finding.lineItemId ?? '', offerKey: finding.otherKey, offerName: finding.otherName });
      return makeReason('EXCLUSIVE_CONFLICT', params, [candidate.key, finding.otherKey]);
    }
    return makeReason('HELD_SERVICE_CONFLICT', { ...params, reference: finding.reference ?? '' }, [candidate.key, finding.otherKey]);
  });
  return { status: 'unavailable', reasons, ...(replaces.length > 0 ? { replaces } : {}) };
}

/**
 * A conflict declared after the cart was built. For each conflicting pair the LATER line in cart order gets a blocking
 * `replace` issue naming both; a plan line that conflicts with a held service gets a blocking `remove` issue. One issue per
 * line, cart order.
 */
export function revalidateExclusivity(cartLines: CartLineRef[], held: HeldService[], offersByKey: Record<string, Offer>): CartIssue[] {
  const issues: CartIssue[] = [];
  cartLines.forEach((line, index) => {
    const offer = offersByKey[line.offerKey];
    if (!offer) return;
    const reasons: CartIssue['reasons'] = [];
    let heldConflict = false;
    for (const earlier of cartLines.slice(0, index)) {
      if (earlier.offerKey === line.offerKey) continue;
      const other = offersByKey[earlier.offerKey];
      if (!other || !conflictBetween(offer, other)) continue;
      reasons.push(makeReason('EXCLUSIVE_CONFLICT', { candidateName: offer.name, otherName: other.name }, [offer.key, other.key]));
    }
    if (offer.kind === 'base-package' || offer.kind === 'bundle') {
      for (const service of held) {
        const other = offersByKey[service.offerKey];
        if (service.offerKey === offer.key || !other || !conflictBetween(offer, other)) continue;
        heldConflict = true;
        reasons.push(makeReason('HELD_SERVICE_CONFLICT', { candidateName: offer.name, otherName: other.name, reference: service.reference }, [offer.key, other.key]));
      }
    }
    if (reasons.length > 0) {
      issues.push({ lineItemId: line.lineItemId, offerKey: line.offerKey, blocking: true, resolution: heldConflict ? 'remove' : 'replace', reasons });
    }
  });
  return issues;
}

/** What "Replace X with Y" removes: the replaced plan line and its dependents (add-ons, equipment). The new plan is added after. */
export function replacementPlan(cartLines: CartLineRef[], replaceLineItemId: string): { removeIds: string[] } {
  return { removeIds: removalPlan(cartLines, replaceLineItemId).removeIds };
}

/** Drops verdict reasons and replace targets that J's evaluation and K's exclusivity check both produced for the same pair. */
export function dedupeVerdict(verdict: CompatVerdict): CompatVerdict {
  const seenReasons = new Set<string>();
  const reasons = verdict.reasons.filter((reason) => {
    const id = `${reason.code}|${reason.offerKeys.join(',')}`;
    if (seenReasons.has(id)) return false;
    seenReasons.add(id);
    return true;
  });
  const seenLines = new Set<string>();
  const replaces = (verdict.replaces ?? []).filter((target) => !seenLines.has(target.lineItemId) && seenLines.add(target.lineItemId));
  const result: CompatVerdict = { ...verdict, reasons };
  if (replaces.length > 0) result.replaces = replaces;
  else delete result.replaces;
  return result;
}
