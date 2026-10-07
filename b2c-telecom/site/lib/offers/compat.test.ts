import * as fx from './__fixtures__/offers';
import { conflictBetween, evaluateCandidate } from './compat';

const codes = (verdict: { reasons: { code: string }[] }) => verdict.reasons.map((reason) => reason.code);

describe('evaluateCandidate', () => {
  it('Equipment too slow for the plan: AC1200 (300) on Cable Gig (1000) is unavailable with SPEED_TOO_LOW and max 300 / needed 1000', () => {
    const verdict = evaluateCandidate(fx.cableGig, fx.routerAc1200);
    expect(verdict.status).toBe('unavailable');
    expect(verdict.reasons[0]).toEqual({
      code: 'SPEED_TOO_LOW',
      messageKey: 'offers.reason.SPEED_TOO_LOW',
      params: { planName: 'Cable Gig', candidateName: 'Malva WiFi 5 Router AC1200', max: 300, needed: 1000 },
      offerKeys: ['malva-offer-cable-gig', 'malva-offer-router-ac1200'],
    });
  });

  it('allows equal speed and faster equipment', () => {
    expect(evaluateCandidate(fx.cableGig, fx.routerAx3000).status).toBe('allowed');
    expect(evaluateCandidate(fx.cableGig, fx.meshBe9300).status).toBe('allowed');
    expect(evaluateCandidate(fx.wireless5gPlus, fx.routerAx3000).status).toBe('allowed');
  });

  it('Equipment unable to use the technology: DOCSIS modem on Air 5G is unavailable with TECHNOLOGY_MISMATCH', () => {
    const verdict = evaluateCandidate(fx.wireless5g, fx.modemDocsis31);
    expect(verdict.status).toBe('unavailable');
    expect(codes(verdict)).toEqual(['TECHNOLOGY_MISMATCH']);
    expect(codes(evaluateCandidate(fx.cable500, fx.gateway5g))).toEqual(['TECHNOLOGY_MISMATCH']);
  });

  it('collects every failing rule, technology before speed', () => {
    const slowWrongTech = fx.withFacts(fx.gateway5g, { maxDownstreamMbps: 100 });
    expect(codes(evaluateCandidate(fx.cable500, slowWrongTech))).toEqual(['TECHNOLOGY_MISMATCH', 'SPEED_TOO_LOW']);
  });

  it('Included extra not sold again: Apple TV+ on Cable Gig has status included and ALREADY_INCLUDED', () => {
    const verdict = evaluateCandidate(fx.cableGig, fx.appletv);
    expect(verdict.status).toBe('included');
    expect(codes(verdict)).toEqual(['ALREADY_INCLUDED']);
    expect(evaluateCandidate(fx.cable500, fx.appletv).status).toBe('allowed');
    expect(evaluateCandidate(fx.cable500, fx.modemDocsis31).status).toBe('included');
    expect(evaluateCandidate(fx.wireless5gPlus, fx.gateway5g).status).toBe('included');
  });

  it('Explicit exception overrides computed compatibility: a router that would pass every computed rule but lists the plan in incompatible-with is DECLARED_INCOMPATIBLE', () => {
    const withoutException = fx.withFacts(fx.routerAx3000, { incompatibleWith: [] });
    expect(evaluateCandidate(fx.wirelessLite, withoutException).status).toBe('allowed');
    const verdict = evaluateCandidate(fx.wirelessLite, fx.routerAx3000);
    expect(verdict.status).toBe('unavailable');
    expect(codes(verdict)).toEqual(['DECLARED_INCOMPATIBLE']);
  });

  it('resolves a declared exception written as a product key', () => {
    const byProduct = fx.withFacts(fx.routerAx3000, { incompatibleWith: ['malva-wireless-lite'] });
    expect(codes(evaluateCandidate(fx.wirelessLite, byProduct))).toEqual(['DECLARED_INCOMPATIBLE']);
  });

  it('FAMILY_MISMATCH is the only reason for another plan family', () => {
    expect(codes(evaluateCandidate(fx.cableGig, fx.deviceProtect))).toEqual(['FAMILY_MISMATCH']);
    expect(codes(evaluateCandidate(fx.phoneUnlimited, fx.appletv))).toEqual(['FAMILY_MISMATCH']);
    expect(codes(evaluateCandidate(fx.phoneUnlimited, fx.routerAx3000))).toEqual(['FAMILY_MISMATCH']);
    expect(evaluateCandidate(fx.cable500, fx.secure).status).toBe('allowed');
    expect(evaluateCandidate(fx.phoneUnlimited, fx.deviceProtect).status).toBe('allowed');
  });

  it('a listed add-on is a positive exception that skips the family rule, but not an included or declared one', () => {
    expect(codes(evaluateCandidate(fx.phoneUnlimited, fx.netflix))).toEqual(['FAMILY_MISMATCH']);
    expect(evaluateCandidate(fx.phoneUnlimitedMax, fx.netflix).status).toBe('allowed');
    expect(evaluateCandidate(fx.phoneUnlimitedMax, fx.appletv).status).toBe('unavailable');
    expect(evaluateCandidate(fx.phoneUnlimitedMax, fx.spotify).status).toBe('included');
  });

  it('fails closed when a deciding attribute is missing', () => {
    const noSpeed = fx.withFacts(fx.routerAc1200, { maxDownstreamMbps: undefined });
    expect(codes(evaluateCandidate(fx.cable100, noSpeed))).toEqual(['CATALOG_DATA_INCOMPLETE']);
    const noTech = fx.withFacts(fx.routerAc1200, { supportedTechnologies: [] });
    expect(codes(evaluateCandidate(fx.cable100, noTech))).toEqual(['CATALOG_DATA_INCOMPLETE']);
    const noFamilies = fx.withFacts(fx.secure, { appliesToFamilies: [] });
    expect(codes(evaluateCandidate(fx.cable100, noFamilies))).toEqual(['CATALOG_DATA_INCOMPLETE']);
    const noPlanSpeed = fx.withFacts(fx.cable100, { downstreamMbps: undefined });
    expect(codes(evaluateCandidate(noPlanSpeed, fx.routerAc1200))).toEqual(['CATALOG_DATA_INCOMPLETE']);
    expect(codes(evaluateCandidate(fx.cable100, fx.cable500))).toEqual(['CATALOG_DATA_INCOMPLETE']);
  });

  it('Catalog edit changes behaviour: raising the router max speed from 300 to 1000 makes it allowed on Cable Gig with no code change', () => {
    expect(evaluateCandidate(fx.cableGig, fx.routerAc1200).status).toBe('unavailable');
    const edited = fx.withFacts(fx.routerAc1200, { maxDownstreamMbps: 1000 });
    expect(evaluateCandidate(fx.cableGig, edited).status).toBe('allowed');
  });
});

describe('conflictBetween', () => {
  it('is symmetric even when only one side declares the conflict', () => {
    expect(conflictBetween(fx.wireless5g, fx.cable500)).toBe(true);
    expect(conflictBetween(fx.cable500, fx.wireless5g)).toBe(true);
    const oneSided = { ...fx.cable100, conflictsWith: [] };
    expect(conflictBetween(oneSided, fx.cable500)).toBe(true);
    expect(conflictBetween(fx.cable500, oneSided)).toBe(true);
  });

  it('phone plans conflict with nothing', () => {
    expect(conflictBetween(fx.phoneUnlimited, fx.cable500)).toBe(false);
    expect(conflictBetween(fx.phoneUnlimited, fx.phoneEssential)).toBe(false);
  });
});
