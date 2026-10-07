import type { BuyerContext, Offer } from '@/lib/types';
import { appletv, cable100, cable500, cartOffersByKey, deviceProtect, phoneEssential, phoneUnlimited, routerAx3000, spotify, wireless5g } from './__fixtures__/offers';
import { guardAdd, revalidateLines, type GuardInput, type GuardLine } from './guard';

const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({
  customerType: 'consumer',
  isExistingCustomer: false,
  channel: 'online',
  now: new Date('2026-10-07T12:00:00Z'),
  held: [],
  signedIn: false,
  ...patch,
});

const offersByKey = cartOffersByKey();
const line = (lineItemId: string, offer: Offer, sku: string, patch: Partial<GuardLine> = {}): GuardLine => ({ lineItemId, offerKey: offer.key, sku, quantity: 1, ...patch });
const input = (candidate: Offer, sku: string, lines: GuardLine[] = [], patch: Partial<GuardInput> = {}): GuardInput => ({
  candidate,
  sku,
  quantity: 1,
  lines,
  offersByKey,
  buyer: buyer(),
  ...patch,
});

const cableLine = line('L1', cable500, 'MLV-CBL-500-24M');
const phoneLine = line('L2', phoneEssential, 'MLV-PHN-ESS-M2M');

describe('guardAdd', () => {
  it('allows a plan on an empty bundle and returns its parent and required equipment', () => {
    const result = guardAdd(input(cable500, 'MLV-CBL-500-24M'));
    expect(result).toMatchObject({ allowed: true, equipment: [] });
  });

  it('allows an add-on and names the plan line as parent', () => {
    expect(guardAdd(input(appletv, 'MLV-ADD-APPLETV-MTH', [cableLine]))).toMatchObject({ allowed: true, parentLineId: 'L1' });
  });

  it('an add-on with no plan in the bundle is invalid (parent required)', () => {
    const result = guardAdd(input(spotify, 'MLV-ADD-SPOTIFY-MTH', []));
    expect(result).toMatchObject({ allowed: false, blocked: { kind: 'invalid', reasons: [{ code: 'PARENT_REQUIRED' }] } });
  });

  it('incompatible: a phone-only add-on on a cable plan lists the reason', () => {
    const result = guardAdd(input(deviceProtect, 'MLV-ADD-DEVCARE-MTH', [cableLine]));
    expect(result).toMatchObject({ allowed: false, blocked: { kind: 'incompatible', offerKey: deviceProtect.key } });
    if (!result.allowed) expect(result.blocked.reasons[0]).toMatchObject({ code: 'FAMILY_MISMATCH', messageKey: 'offers.reason.FAMILY_MISMATCH' });
  });

  it('a conflict returns the line to replace', () => {
    const result = guardAdd(input(wireless5g, 'MLV-AIR-5G-12M', [cableLine]));
    expect(result).toMatchObject({
      allowed: false,
      blocked: { kind: 'conflict', replace: { removeLineId: 'L1', removeOfferKey: 'malva-offer-cable-500', removeOfferName: 'Cable 500' } },
    });
  });

  it('a conflict is symmetric: A then B and B then A both report', () => {
    const wirelessLine = line('L3', wireless5g, 'MLV-AIR-5G-12M');
    expect(guardAdd(input(wireless5g, 'MLV-AIR-5G-12M', [cableLine]))).toMatchObject({ allowed: false, blocked: { kind: 'conflict' } });
    expect(guardAdd(input(cable500, 'MLV-CBL-500-24M', [wirelessLine]))).toMatchObject({ allowed: false, blocked: { kind: 'conflict', replace: { removeLineId: 'L3' } } });
  });

  it('ONE_PLAN_PER_CATEGORY: a second phone plan is a conflict with replace; a different term of the same plan too', () => {
    const other = guardAdd(input(phoneUnlimited, 'MLV-PHN-UNL-24M', [phoneLine]));
    expect(other).toMatchObject({ allowed: false, blocked: { kind: 'conflict', reasons: [{ code: 'ONE_PLAN_PER_CATEGORY' }], replace: { removeLineId: 'L2' } } });
    const term = guardAdd(input(cable500, 'MLV-CBL-500-M2M', [cableLine]));
    expect(term).toMatchObject({ allowed: false, blocked: { kind: 'conflict', replace: { removeLineId: 'L1' } } });
    expect(guardAdd(input(cable100, 'MLV-CBL-100-24M', [cableLine]))).toMatchObject({ allowed: false, blocked: { kind: 'conflict' } });
  });

  it('quantity rules: a phone plan again is allowed up to 5 lines, the sixth is refused; a cable plan again is QUANTITY_FIXED', () => {
    expect(guardAdd(input(phoneEssential, 'MLV-PHN-ESS-M2M', [{ ...phoneLine, quantity: 4 }]))).toMatchObject({ allowed: true });
    expect(guardAdd(input(phoneEssential, 'MLV-PHN-ESS-M2M', [{ ...phoneLine, quantity: 5 }]))).toMatchObject({ allowed: false, blocked: { kind: 'limit', reasons: [{ code: 'QUANTITY_OUT_OF_RANGE' }] } });
    expect(guardAdd(input(cable500, 'MLV-CBL-500-24M', [cableLine]))).toMatchObject({ allowed: false, blocked: { kind: 'limit', reasons: [{ code: 'QUANTITY_FIXED' }] } });
    expect(guardAdd(input(phoneEssential, 'MLV-PHN-ESS-M2M', [], { quantity: 6 }))).toMatchObject({ allowed: false, blocked: { kind: 'limit' } });
  });

  it('an ineligible offer is `ineligible`, absolute, and is reported before exclusivity and compatibility', () => {
    const employeeOnly: Offer = { ...appletv, audience: ['employee'] };
    const result = guardAdd(input(employeeOnly, 'MLV-ADD-APPLETV-MTH', [cableLine], { offersByKey: { ...offersByKey, [appletv.key]: employeeOnly } }));
    expect(result).toMatchObject({ allowed: false, blocked: { kind: 'ineligible', reasons: [{ code: 'NOT_ELIGIBLE_AUDIENCE' }] } });
  });

  it('order of the groups: M rules, then eligibility, then exclusivity and compatibility', () => {
    const employeeOnly: Offer = { ...phoneUnlimited, audience: ['employee'] };
    const offers = { ...offersByKey, [phoneUnlimited.key]: employeeOnly };
    // M rule (one plan per category) wins over eligibility
    expect(guardAdd(input(employeeOnly, 'MLV-PHN-UNL-24M', [phoneLine], { offersByKey: offers }))).toMatchObject({ blocked: { kind: 'conflict' } });
    // eligibility wins over compatibility
    expect(guardAdd(input({ ...deviceProtect, audience: ['employee'] }, 'MLV-ADD-DEVCARE-MTH', [cableLine]))).toMatchObject({ blocked: { kind: 'ineligible' } });
  });

  it('a held service that conflicts is a conflict without a line to replace', () => {
    const held = [{ offerKey: 'malva-offer-cable-500', offerName: 'Cable 500', source: 'order' as const, reference: 'MLV-1' }];
    const result = guardAdd(input(wireless5g, 'MLV-AIR-5G-12M', [], { buyer: buyer({ held, signedIn: true }) }));
    expect(result).toMatchObject({ allowed: false, blocked: { kind: 'conflict', reasons: [{ code: 'HELD_SERVICE_CONFLICT' }] } });
    if (!result.allowed) expect(result.blocked.replace).toBeUndefined();
  });

  it('a plan that needs equipment nothing included can fulfil lists the selection (D-025)', () => {
    const needsRouter: Offer = { ...cable500, includedOffers: [], facts: { ...(cable500.facts as object), requiredEquipmentKinds: ['router'] } as never };
    const result = guardAdd(input(needsRouter, 'MLV-CBL-500-24M', [], { offersByKey: { ...offersByKey, [cable500.key]: needsRouter } }));
    expect(result).toMatchObject({ allowed: true, equipment: [{ kind: 'router', offerKey: routerAx3000.key }] });
  });
});

describe('revalidateLines', () => {
  it('returns J and K issues as blocking bundle issues, one per line', () => {
    const employeeOnly: Offer = { ...appletv, audience: ['employee'] };
    const issues = revalidateLines({
      lines: [cableLine, line('L4', appletv, 'MLV-ADD-APPLETV-MTH', { parentLineItemId: 'L1' })],
      offersByKey: { ...offersByKey, [appletv.key]: employeeOnly },
      buyer: buyer(),
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'blocking', lineId: 'L4', offerKey: appletv.key, resolution: 'remove' });
    expect(issues[0]?.reasons[0]?.code).toBe('NOT_ELIGIBLE_AUDIENCE');
  });

  it('a clean bundle has no issues; an orphaned dependent is flagged', () => {
    expect(revalidateLines({ lines: [cableLine], offersByKey, buyer: buyer() })).toEqual([]);
    const orphan = revalidateLines({ lines: [cableLine, line('L4', appletv, 'MLV-ADD-APPLETV-MTH', { parentLineItemId: 'gone' })], offersByKey, buyer: buyer() });
    expect(orphan[0]).toMatchObject({ lineId: 'L4', reasons: [{ code: 'PARENT_REQUIRED' }] });
  });
});
