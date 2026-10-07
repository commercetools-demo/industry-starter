import * as fx from './__fixtures__/offers';
import { evaluateCandidate } from './compat';
import { OfferRuleError, ruleErrorBody } from './errors';

describe('rule errors', () => {
  it('Server re-checks what the card allowed: ruleErrorBody carries code OFFER_RULE_VIOLATION and the reasons', () => {
    const verdict = evaluateCandidate(fx.cableGig, fx.routerAc1200);
    const body = ruleErrorBody(verdict, 'malva-offer-router-ac1200');
    expect(body.error.code).toBe('OFFER_RULE_VIOLATION');
    expect(body.error.message).toBe("That choice isn't available for this plan.");
    expect(body.error.details).toEqual({ offerKey: 'malva-offer-router-ac1200', reasons: verdict.reasons });
  });

  it('includes candidate parents and replaceable lines when the verdict has them', () => {
    const body = ruleErrorBody(
      { status: 'unavailable', reasons: [], candidateParents: ['A', 'B'], replaces: [{ lineItemId: 'A', offerKey: 'k', offerName: 'K' }] },
      'malva-offer-spotify',
    );
    expect(body.error.details.candidateParents).toEqual(['A', 'B']);
    expect(body.error.details.replaces).toEqual([{ lineItemId: 'A', offerKey: 'k', offerName: 'K' }]);
  });

  it('OfferRuleError carries the verdict and the offer key', () => {
    const verdict = evaluateCandidate(fx.cableGig, fx.routerAc1200);
    const error = new OfferRuleError(verdict, 'malva-offer-router-ac1200');
    expect(error).toBeInstanceOf(Error);
    expect(error.verdict).toBe(verdict);
    expect(error.offerKey).toBe('malva-offer-router-ac1200');
  });
});
