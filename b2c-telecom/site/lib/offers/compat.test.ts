import type { CartLineRef, Offer } from '@/lib/types';
import * as fx from './__fixtures__/offers';
import { attachmentFields } from './addons';
import { buildCandidateList, conflictBetween, evaluateAddition, evaluateCandidate, mergeVerdicts } from './compat';

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

const line = (lineItemId: string, offerKey: string, parentLineItemId?: string): CartLineRef => ({ lineItemId, offerKey, parentLineItemId, quantity: 1 });
const catalog = fx.offersByKey();
const add = (candidate: Offer, cart: CartLineRef[], extra: { planOffer?: Offer; requestedParentLineItemId?: string } = {}) =>
  evaluateAddition({ candidate, cart, offersByKey: catalog, ...extra });

describe('evaluateAddition: card mode', () => {
  it('evaluates against the card plan and ignores the cart', () => {
    expect(add(fx.routerAc1200, [], { planOffer: fx.cableGig }).status).toBe('unavailable');
    expect(add(fx.routerAx3000, [line('A', 'malva-offer-phone-plus')], { planOffer: fx.cableGig }).status).toBe('allowed');
  });

  it('device offers are not evaluated here', () => {
    const device: Offer = { ...fx.spotify, kind: 'device' };
    expect(add(device, []).status).toBe('allowed');
  });
});

describe('evaluateAddition: cart mode', () => {
  it('Compatible add on accepted: Spotify on Cable 500 is allowed and attachmentFields names the plan line', () => {
    const verdict = add(fx.spotify, [line('P1', 'malva-offer-cable-500')]);
    expect(verdict).toEqual({ status: 'allowed', reasons: [], parentLineItemId: 'P1' });
    expect(attachmentFields(verdict, fx.spotify)).toEqual({ offerKey: 'malva-offer-spotify', parentLineItemId: 'P1' });
  });

  it('Incompatible add on refused: an add-on outside the plan family is FAMILY_MISMATCH, not a generic failure', () => {
    const verdict = add(fx.appletv, [line('P1', 'malva-offer-phone-unlimited')]);
    expect(verdict.status).toBe('unavailable');
    expect(codes(verdict)).toEqual(['FAMILY_MISMATCH']);
    expect(verdict.reasons[0].offerKeys).toEqual(['malva-offer-phone-unlimited', 'malva-offer-appletv']);
  });

  it('Included extra not charged again: the included add-on is reported included, never allowed', () => {
    const verdict = add(fx.appletv, [line('P1', 'malva-offer-cable-gig')]);
    expect(verdict.status).toBe('included');
    expect(codes(verdict)).toEqual(['ALREADY_INCLUDED']);
  });

  it('Same add on different offer: with a phone plan and an internet plan in the cart a streaming add-on for internet only attaches to the internet line and the parent is unambiguous', () => {
    const cart = [line('PHONE', 'malva-offer-phone-unlimited'), line('NET', 'malva-offer-cable-500')];
    const verdict = add(fx.appletv, cart);
    expect(verdict.status).toBe('allowed');
    expect(verdict.parentLineItemId).toBe('NET');
    expect(verdict.candidateParents).toBeUndefined();
  });

  it('Spotify with a phone plan and a cable plan is AMBIGUOUS_PARENT; naming the phone line allows it there', () => {
    const cart = [line('PHONE', 'malva-offer-phone-essential'), line('NET', 'malva-offer-cable-500')];
    const ambiguous = add(fx.spotify, cart);
    expect(ambiguous.status).toBe('unavailable');
    expect(codes(ambiguous)).toEqual(['AMBIGUOUS_PARENT']);
    expect(ambiguous.candidateParents).toEqual(['PHONE', 'NET']);
    expect(add(fx.spotify, cart, { requestedParentLineItemId: 'PHONE' })).toEqual({ status: 'allowed', reasons: [], parentLineItemId: 'PHONE' });
  });

  it('a requested parent that is not a plan line is PARENT_REQUIRED', () => {
    const cart = [line('NET', 'malva-offer-cable-500'), line('ADD', 'malva-offer-spotify', 'NET')];
    expect(codes(add(fx.secure, cart, { requestedParentLineItemId: 'ADD' }))).toEqual(['PARENT_REQUIRED']);
    expect(codes(add(fx.secure, cart, { requestedParentLineItemId: 'nope' }))).toEqual(['PARENT_REQUIRED']);
  });

  it('with no plan in the cart the answer is PARENT_REQUIRED', () => {
    const verdict = add(fx.spotify, []);
    expect(verdict.status).toBe('unavailable');
    expect(codes(verdict)).toEqual(['PARENT_REQUIRED']);
  });

  it('a second attach to the same parent is ALREADY_ATTACHED', () => {
    const cart = [line('NET', 'malva-offer-cable-500'), line('ADD', 'malva-offer-spotify', 'NET')];
    const verdict = add(fx.spotify, cart);
    expect(codes(verdict)).toEqual(['ALREADY_ATTACHED']);
    expect(verdict.reasons[0].params).toEqual({ planName: 'Cable 500' });
  });

  it('collects the reasons of every plan line when none can carry the candidate', () => {
    const cart = [line('P1', 'malva-offer-phone-plus'), line('P2', 'malva-offer-phone-essential')];
    const verdict = add(fx.routerAx3000, cart);
    expect(verdict.reasons.map((reason) => reason.offerKeys[0])).toEqual(['malva-offer-phone-plus', 'malva-offer-phone-essential']);
  });
});

describe('evaluateAddition: plan candidates', () => {
  it('Conflicting home internet services: adding Air 5G with Cable 500 in the cart is refused naming both, with a replaces entry, whichever was added first', () => {
    const forward = add(fx.wireless5g, [line('NET', 'malva-offer-cable-500')]);
    expect(forward.status).toBe('unavailable');
    expect(forward.reasons[0]).toMatchObject({
      code: 'EXCLUSIVE_CONFLICT',
      params: { candidateName: 'Air 5G', otherName: 'Cable 500' },
      offerKeys: ['malva-offer-wireless-5g', 'malva-offer-cable-500'],
    });
    expect(forward.replaces).toEqual([{ lineItemId: 'NET', offerKey: 'malva-offer-cable-500', offerName: 'Cable 500' }]);
    const reverse = add(fx.cable500, [line('AIR', 'malva-offer-wireless-5g')]);
    expect(codes(reverse)).toEqual(['EXCLUSIVE_CONFLICT']);
    expect(reverse.replaces?.[0].lineItemId).toBe('AIR');
  });

  it('a phone plan never conflicts and the same offer again is not a conflict', () => {
    expect(add(fx.phoneUnlimited, [line('NET', 'malva-offer-cable-500'), line('PH', 'malva-offer-phone-unlimited')]).status).toBe('allowed');
    expect(add(fx.cable500, [line('NET', 'malva-offer-cable-500')]).status).toBe('allowed');
  });

  it('lists the default required equipment; the seeded modem is included so no line is needed', () => {
    expect(add(fx.cable500, []).requiredEquipment).toEqual([]);
    const needsRouter = fx.plan({ id: 'cable-gig-router', name: 'Cable Gig R', family: 'internet', technology: 'cable', mbps: 1000, required: ['router'] });
    const withRouter = evaluateAddition({ candidate: needsRouter, cart: [], offersByKey: { ...catalog, [needsRouter.key]: needsRouter } });
    expect(withRouter.status).toBe('allowed');
    expect(withRouter.requiredEquipment).toEqual([{ kind: 'router', offerKey: 'malva-offer-router-ax3000', variantSku: 'MLV-EQP-ROUTER-AX3000-RENT', mode: 'rental' }]);
  });

  it('a plan whose required kind nothing can fulfil is unavailable with REQUIRED_EQUIPMENT_MISSING', () => {
    const needsExtender = fx.plan({ id: 'x', name: 'X', family: 'internet', technology: 'cable', mbps: 100, required: ['extender'] });
    const verdict = evaluateAddition({ candidate: needsExtender, cart: [], offersByKey: { ...catalog, [needsExtender.key]: needsExtender } });
    expect(verdict.status).toBe('unavailable');
    expect(verdict.reasons[0]).toMatchObject({ code: 'REQUIRED_EQUIPMENT_MISSING', params: { planName: 'X', kind: 'extender' } });
  });
});

describe('buildCandidateList', () => {
  const extras = [fx.appletv, fx.spotify, fx.secure, fx.deviceProtect, fx.routerAc1200, fx.routerAx3000, fx.modemDocsis31];

  it('Add-on for another plan family: Device Care is not in the candidate list of an internet plan card', () => {
    const keys = buildCandidateList(fx.cable500, extras).map((entry) => entry.offer.key);
    expect(keys).not.toContain('malva-offer-device-protect');
    expect(keys).toEqual([
      'malva-offer-appletv',
      'malva-offer-spotify',
      'malva-offer-secure',
      'malva-offer-router-ac1200',
      'malva-offer-router-ax3000',
      'malva-offer-modem-docsis31',
    ]);
  });

  it('returns slow equipment disabled with its reason and included extras as included', () => {
    const list = buildCandidateList(fx.cableGig, extras);
    const status = Object.fromEntries(list.map((entry) => [entry.offer.key, entry.verdict.status]));
    expect(status).toMatchObject({
      'malva-offer-router-ac1200': 'unavailable',
      'malva-offer-router-ax3000': 'allowed',
      'malva-offer-appletv': 'included',
      'malva-offer-modem-docsis31': 'included',
    });
    expect(list.find((entry) => entry.offer.key === 'malva-offer-router-ac1200')?.verdict.reasons[0].code).toBe('SPEED_TOO_LOW');
  });

  it('marks candidates already on the plan as ALREADY_ATTACHED', () => {
    const list = buildCandidateList(fx.cable500, [fx.spotify, fx.secure], ['malva-offer-spotify']);
    expect(list[0].verdict.reasons[0].code).toBe('ALREADY_ATTACHED');
    expect(list[1].verdict.status).toBe('allowed');
  });

  it('keeps phone-plan add-ons and never lists equipment on a phone card', () => {
    const keys = buildCandidateList(fx.phoneUnlimited, extras).map((entry) => entry.offer.key);
    expect(keys).toContain('malva-offer-device-protect');
    expect(keys).not.toContain('malva-offer-router-ax3000');
  });
});

describe('mergeVerdicts', () => {
  it('concatenates reasons and takes the worst status', () => {
    const allowed = { status: 'allowed' as const, reasons: [], parentLineItemId: 'P' };
    const included = evaluateCandidate(fx.cableGig, fx.appletv);
    const unavailable = evaluateCandidate(fx.cableGig, fx.routerAc1200);
    expect(mergeVerdicts(allowed, included).status).toBe('included');
    const merged = mergeVerdicts(included, unavailable);
    expect(merged.status).toBe('unavailable');
    expect(codes(merged)).toEqual(['ALREADY_INCLUDED', 'SPEED_TOO_LOW']);
    expect(mergeVerdicts(allowed, allowed)).toEqual({ status: 'allowed', reasons: [], parentLineItemId: 'P' });
  });
});
