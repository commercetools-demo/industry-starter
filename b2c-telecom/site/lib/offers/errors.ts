import type { CompatVerdict, Reason, ReplaceTarget } from '@/lib/types';

/** Thrown by cart code when a write would break an offer rule. */
export class OfferRuleError extends Error {
  constructor(
    readonly verdict: CompatVerdict,
    readonly offerKey: string,
  ) {
    super(`Offer rule violation for ${offerKey}`);
    this.name = 'OfferRuleError';
  }
}

export interface RuleErrorBody {
  error: {
    code: 'OFFER_RULE_VIOLATION';
    message: string;
    details: { offerKey: string; reasons: Reason[]; candidateParents?: string[]; replaces?: ReplaceTarget[] };
  };
}

/** The 409 body of a refused cart write. The card renders the localized text from `details.reasons`; `message` is a fixed fallback. */
export function ruleErrorBody(verdict: CompatVerdict, offerKey: string): RuleErrorBody {
  return {
    error: {
      code: 'OFFER_RULE_VIOLATION',
      message: "That choice isn't available for this plan.",
      details: {
        offerKey,
        reasons: verdict.reasons,
        ...(verdict.candidateParents ? { candidateParents: verdict.candidateParents } : {}),
        ...(verdict.replaces ? { replaces: verdict.replaces } : {}),
      },
    },
  };
}
