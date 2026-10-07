import * as fx from '@/lib/offers/__fixtures__/offers';
import type { BuyerContext, CartLineRef, Offer, ServiceLocation } from '@/lib/types';
import { createCachedServiceability, createStubProvider } from './serviceability';
import { customerTypeFromGroups, describeAvailability, evaluateEligibility, filterEligible, resolveVisibleOffer, revalidateCartEligibility } from './eligibility';

const NOW = new Date('2026-10-07T12:00:00Z');
const byKey = fx.offersByKey();
const zip = (code: string, country: 'US' | 'DE' = 'US'): Promise<ServiceLocation> => createCachedServiceability(createStubProvider('table'), 300).check(code, country);
const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({
  customerType: 'consumer',
  isExistingCustomer: false,
  channel: 'online',
  now: NOW,
  held: [],
  signedIn: false,
  ...patch,
});
const withRules = (offer: Offer, patch: Partial<Offer>): Offer => ({ ...offer, ...patch });
const codes = (offer: Offer, context: BuyerContext) => evaluateEligibility(offer, context).reasons.map((reason) => reason.code);

describe('evaluateEligibility rules', () => {
  it('everyone is eligible when no rule is set', () => {
    expect(evaluateEligibility(fx.cable500, buyer())).toEqual({ eligible: true, reasons: [] });
  });

  it('audience: fails when the buyer type is not listed and passes when it is', () => {
    const offer = withRules(fx.phonePlus, { audience: ['employee', 'small-business'] });
    expect(codes(offer, buyer())).toEqual(['NOT_ELIGIBLE_AUDIENCE']);
    expect(codes(offer, buyer({ customerType: 'employee' }))).toEqual([]);
  });

  it('existing customer rule: existing and new, each with its rule parameter', () => {
    const existing = withRules(fx.cable500, { existingCustomer: 'existing' });
    const onlyNew = withRules(fx.cable500, { existingCustomer: 'new' });
    expect(evaluateEligibility(existing, buyer()).reasons[0]).toMatchObject({ code: 'NOT_ELIGIBLE_EXISTING_CUSTOMER', params: { offerName: 'Cable 500', rule: 'existing' }, messageKey: 'offers.reason.NOT_ELIGIBLE_EXISTING_CUSTOMER' });
    expect(codes(existing, buyer({ isExistingCustomer: true }))).toEqual([]);
    expect(evaluateEligibility(onlyNew, buyer({ isExistingCustomer: true })).reasons[0].params).toMatchObject({ rule: 'new' });
    expect(codes(onlyNew, buyer())).toEqual([]);
  });

  it('channel: an offer limited to other channels fails and a listed channel passes', () => {
    const offer = withRules(fx.phonePlus, { channels: ['retail', 'call-center'] });
    const reason = evaluateEligibility(offer, buyer()).reasons[0];
    expect(reason).toMatchObject({ code: 'NOT_ELIGIBLE_CHANNEL', params: { channel: 'online', allowed: 'retail, call-center' } });
    expect(codes(withRules(fx.phonePlus, { channels: ['online'] }), buyer())).toEqual([]);
  });

  it('schedule: not started before startTime, ended from endTime on (end exclusive)', () => {
    const scheduled = withRules(fx.cable500, { startTime: '2026-10-07T12:00:00Z', endTime: '2026-10-08T00:00:00Z' });
    expect(codes(scheduled, buyer({ now: new Date('2026-10-07T11:59:59Z') }))).toEqual(['NOT_STARTED']);
    expect(codes(scheduled, buyer({ now: NOW }))).toEqual([]);
    expect(codes(scheduled, buyer({ now: new Date('2026-10-08T00:00:00Z') }))).toEqual(['ENDED']);
  });

  it('collects every failing rule, primary first, in the documented order', () => {
    const offer = withRules(fx.cable500, { audience: ['employee'], existingCustomer: 'existing', channels: ['retail'], endTime: '2026-01-01T00:00:00Z' });
    expect(codes(offer, buyer({ location: undefined }))).toEqual(['NOT_ELIGIBLE_AUDIENCE', 'NOT_ELIGIBLE_EXISTING_CUSTOMER', 'NOT_ELIGIBLE_CHANNEL', 'ENDED']);
  });
});

describe('serviceability gating', () => {
  it('no location means not gated', () => {
    expect(filterEligible(fx.ALL_OFFERS, buyer())).toHaveLength(fx.ALL_OFFERS.length);
  });

  it('plans: cable plans need cable, wireless plans need fixed wireless, phone plans need mobile', async () => {
    const cableOnly = buyer({ location: await zip('60601') });
    expect(codes(fx.cable500, cableOnly)).toEqual([]);
    expect(evaluateEligibility(fx.wireless5g, cableOnly).reasons[0]).toMatchObject({ code: 'NOT_SERVICEABLE', params: { offerName: 'Air 5G', postalCode: '60601' } });
    expect(codes(fx.phoneEssential, cableOnly)).toEqual([]);
    const mobileOnly = buyer({ location: await zip('59001') });
    expect(codes(fx.phoneEssential, mobileOnly)).toEqual([]);
    expect(codes(fx.cable500, mobileOnly)).toEqual(['NOT_SERVICEABLE']);
  });

  it('add-ons are gated only when every family they apply to is unserved', async () => {
    const mobileOnly = buyer({ location: await zip('59001') });
    expect(codes(fx.spotify, mobileOnly)).toEqual([]); // internet and phone: phone is served
    expect(codes(fx.appletv, mobileOnly)).toEqual(['NOT_SERVICEABLE']); // internet only
    expect(codes(fx.deviceProtect, mobileOnly)).toEqual([]); // phone only
    const wirelessOnly = buyer({ location: await zip('73301') });
    expect(codes(fx.appletv, wirelessOnly)).toEqual([]); // internet is served by fixed wireless
  });

  it('equipment is internet, devices are phone', async () => {
    const mobileOnly = buyer({ location: await zip('59001') });
    expect(codes(fx.routerAx3000, mobileOnly)).toEqual(['NOT_SERVICEABLE']);
    const device: Offer = { ...fx.spotify, key: 'malva-offer-device-nova', kind: 'device', facts: { kind: 'device', compatiblePlanFamilies: ['phone'] } };
    expect(codes(device, mobileOnly)).toEqual([]);
    const nothing = buyer({ location: await zip('99999') });
    expect(codes(device, nothing)).toEqual(['NOT_SERVICEABLE']);
    expect(codes(fx.routerAx3000, nothing)).toEqual(['NOT_SERVICEABLE']);
  });

  it('an offer without facts is not gated', async () => {
    expect(codes({ ...fx.cable500, facts: null }, buyer({ location: await zip('99999') }))).toEqual([]);
  });
});

describe('scenarios', () => {
  it('Catalog reflects the location: at a cable-only ZIP the wireless plans are filtered out and cable plans remain', async () => {
    const visible = filterEligible([fx.cable100, fx.cable500, fx.wirelessLite, fx.wireless5g, fx.wireless5gPlus], buyer({ location: await zip('60601') }));
    expect(visible.map((offer) => offer.key)).toEqual(['malva-offer-cable-100', 'malva-offer-cable-500']);
  });

  it('Ineligible offer absent not refused: an existing-customer-only offer is absent from the list and a direct key lookup returns null with the reason', () => {
    const existingOnly = withRules(fx.cableExisting, { existingCustomer: 'existing' });
    const map = { ...byKey, [existingOnly.key]: existingOnly };
    expect(filterEligible([fx.cable500, existingOnly], buyer()).map((offer) => offer.key)).toEqual(['malva-offer-cable-500']);
    const resolved = resolveVisibleOffer(map, existingOnly.key, buyer());
    expect(resolved.offer).toBeNull();
    expect(resolved.reasons.map((reason) => reason.code)).toEqual(['NOT_ELIGIBLE_EXISTING_CUSTOMER']);
    expect(resolveVisibleOffer(map, existingOnly.key, buyer({ isExistingCustomer: true })).offer).toBe(existingOnly);
    expect(resolveVisibleOffer(map, 'malva-offer-nope', buyer())).toMatchObject({ offer: null, reasons: [{ code: 'OFFER_NOT_FOUND' }] });
  });

  it('Channel restricted offer: an offer limited to another channel does not resolve and NOT_ELIGIBLE_CHANNEL is recorded', () => {
    const retail = withRules(fx.phonePlus, { channels: ['retail'] });
    const resolved = resolveVisibleOffer({ ...byKey, [retail.key]: retail }, retail.key, buyer());
    expect(resolved.offer).toBeNull();
    expect(resolved.reasons.map((reason) => reason.code)).toEqual(['NOT_ELIGIBLE_CHANNEL']);
    // the live online-only phone offer lists the channel this storefront sells through
    expect(filterEligible([withRules(fx.phonePlus, { channels: ['online'] })], buyer())).toHaveLength(1);
  });

  it('Location changes mid session: revalidating the same cart with a new location reports the unserved line before checkout', async () => {
    const cart: CartLineRef[] = [
      { lineItemId: 'NET', offerKey: 'malva-offer-wireless-5g', quantity: 1 },
      { lineItemId: 'PH', offerKey: 'malva-offer-phone-essential', quantity: 1 },
    ];
    expect(revalidateCartEligibility(cart, byKey, buyer({ location: await zip('10001') }))).toEqual([]);
    const issues = revalidateCartEligibility(cart, byKey, buyer({ location: await zip('60601') }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ lineItemId: 'NET', offerKey: 'malva-offer-wireless-5g', blocking: true, resolution: 'remove' });
    expect(issues[0].reasons[0]).toMatchObject({ code: 'NOT_SERVICEABLE', params: { postalCode: '60601' } });
    expect(cart).toHaveLength(2); // nothing is dropped
  });
});

describe('Location not served at all', () => {
  it('describes an unserved ZIP as not-served and every plan is filtered, so the UI states it instead of an empty catalog', async () => {
    const location = await zip('99999');
    expect(describeAvailability(location).state).toBe('not-served');
    expect(filterEligible([fx.cable500, fx.wireless5g, fx.phoneEssential], buyer({ location }))).toEqual([]);
  });
});

describe('customerTypeFromGroups and revalidation', () => {
  it('employee wins over small-business wins over consumer', () => {
    expect(customerTypeFromGroups(['existing-customer', 'small-business', 'employee'])).toBe('employee');
    expect(customerTypeFromGroups(['small-business', 'existing-customer'])).toBe('small-business');
    expect(customerTypeFromGroups(['existing-customer'])).toBe('consumer');
    expect(customerTypeFromGroups([])).toBe('consumer');
  });

  it('revalidateCartEligibility flags a missing offer as OFFER_NOT_FOUND and an ineligible offer with its reason', () => {
    const existingOnly = withRules(fx.cableExisting, { existingCustomer: 'existing' });
    const cart: CartLineRef[] = [
      { lineItemId: 'A', offerKey: existingOnly.key, quantity: 1 },
      { lineItemId: 'B', offerKey: 'malva-offer-gone', quantity: 1 },
      { lineItemId: 'C', offerKey: 'malva-offer-phone-plus', quantity: 1 },
    ];
    const issues = revalidateCartEligibility(cart, { ...byKey, [existingOnly.key]: existingOnly }, buyer());
    expect(issues.map((issue) => [issue.lineItemId, issue.reasons[0].code, issue.resolution])).toEqual([
      ['A', 'NOT_ELIGIBLE_EXISTING_CUSTOMER', 'remove'],
      ['B', 'OFFER_NOT_FOUND', 'remove'],
    ]);
  });

  it('has no override parameter', () => {
    expect(evaluateEligibility.length).toBe(2);
    expect(resolveVisibleOffer.length).toBe(3);
    expect(revalidateCartEligibility.length).toBe(3);
  });
});
