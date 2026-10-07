import { evaluateCandidate } from '@/lib/offers/compat';
import type { CartLine, Offer, PlanFamily, Reason } from '@/lib/types';

/** What the add-on card of the add-ons page does with this buyer's bundle. */
export type AddonCardState =
  /** Already in the bundle (a line of this add-on or equipment): the toggle removes it. */
  | { kind: 'added'; line: CartLine }
  /** Can be attached to this plan line: the toggle adds it there. */
  | { kind: 'ready'; parent: CartLine }
  /** No plan in the bundle that this fits: "Needs a plan", with a link to the plans of `family`. */
  | { kind: 'needs-plan'; family: PlanFamily }
  /** Every plan that fits already includes it. */
  | { kind: 'included' }
  /** A plan is there, but the rules refuse (speed, technology, declared incompatibility): the first reason is shown. */
  | { kind: 'unavailable'; reason: Reason | undefined };

/** The kind of plan an offer is for; equipment and anything unspecified belongs to home internet. */
export function familyOf(offer: Offer): PlanFamily {
  return offer.facts?.kind === 'addon' && offer.facts.appliesToFamilies.length > 0 && !offer.facts.appliesToFamilies.includes('internet') ? 'phone' : 'internet';
}

/**
 * The parent of an add-on added from the add-ons page: of the plans in the bundle for which J's rules say `allowed`, the one named by
 * the `?for=` link when it qualifies, else the FIRST in bundle order (unambiguous, "Same add on different offer"). The server re-checks
 * the add, and an ambiguous parent is refused there, so the card always names the parent.
 */
export function resolveAddonCard(offer: Offer, lines: CartLine[], plansByKey: Record<string, Offer>, preferredParentLineId: string | null): AddonCardState {
  const held = lines.find((line) => line.offerKey === offer.key && (line.kind === 'addon' || line.kind === 'equipment'));
  if (held) return { kind: 'added', line: held };
  const planLines = lines.filter((line) => line.kind === 'plan' && plansByKey[line.offerKey] !== undefined);
  if (planLines.length === 0) return { kind: 'needs-plan', family: familyOf(offer) };

  const verdicts = planLines.map((line) => ({ line, verdict: evaluateCandidate(plansByKey[line.offerKey], offer) }));
  const ready = verdicts.filter((entry) => entry.verdict.status === 'allowed');
  if (ready.length > 0) {
    const preferred = ready.find((entry) => entry.line.id === preferredParentLineId) ?? ready[0];
    return { kind: 'ready', parent: preferred.line };
  }
  if (verdicts.some((entry) => entry.verdict.status === 'included')) return { kind: 'included' };
  const reasons = verdicts.flatMap((entry) => entry.verdict.reasons);
  const real = reasons.find((reason) => reason.code !== 'FAMILY_MISMATCH');
  if (!real) return { kind: 'needs-plan', family: familyOf(offer) };
  return { kind: 'unavailable', reason: real };
}
