import type { Attribute, Category as SdkCategory, ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import type { Market, Offer, OfferFacts } from '@/lib/types';
import categories from './__fixtures__/categories.json';
import addonAppleTv from './__fixtures__/addon-appletv.json';
import deviceNova from './__fixtures__/device-nova-5g.json';
import equipmentRouter from './__fixtures__/equipment-router-ac1200.json';
import offerAddonAppleTv from './__fixtures__/offer-addon-appletv.json';
import offerCable500 from './__fixtures__/offer-cable-500.json';
import offerDeviceNova from './__fixtures__/offer-device-nova-5g.json';
import offerPhoneUnlimited from './__fixtures__/offer-phone-unlimited.json';
import offerRouter from './__fixtures__/offer-router-ac1200.json';
import planCableGig from './__fixtures__/plan-cable-gig.json';
import planPhoneUnlimited from './__fixtures__/plan-phone-unlimited.json';
import { mapAddonFacts, mapDeviceFacts, mapEquipmentFacts, mapFacts, mapOffer, mapPlanFacts, mergeFacts } from './offer';

type MutableVariant = Omit<ProductVariant, 'attributes'> & { attributes?: Attribute[] };
type MutableProjection = Omit<ProductProjection, 'masterVariant' | 'variants' | 'description'> & {
  masterVariant: MutableVariant;
  variants: MutableVariant[];
  description?: Record<string, string>;
};
const asProjection = (fixture: unknown): MutableProjection => structuredClone(fixture) as MutableProjection;
const US: Market = { locale: 'en-US', currency: 'USD', country: 'US' };
const DE: Market = { locale: 'de-DE', currency: 'EUR', country: 'DE' };
const NOW = new Date('2026-10-07T12:00:00Z');
const categoryIdToKey = Object.fromEntries((categories as unknown as SdkCategory[]).map((category) => [category.id, category.key ?? '']));
const ctx = (market: Market) => ({ market, categoryIdToKey, now: NOW });

function offerOf(fixture: unknown, market: Market = US): Offer {
  const offer = mapOffer(asProjection(fixture), ctx(market));
  if (!offer) throw new Error('fixture offer was dropped');
  return offer;
}

describe('mapOffer', () => {
  it('uses the master variant first and as headline (24-month cable, month-to-month phone)', () => {
    const cable = offerOf(offerCable500);
    expect(cable.variants[0]).toMatchObject({ isMaster: true, sku: 'MLV-CBL-500-24M', termMonths: 24 });
    expect(cable.headline).toEqual({
      recurring: { centAmount: 5999, currencyCode: 'USD' },
      oneTime: { centAmount: 2500, currencyCode: 'USD' },
      term: '24-months',
      termMonths: 24,
    });
    const phone = offerOf(offerPhoneUnlimited);
    expect(phone.headline).toMatchObject({ recurring: { centAmount: 5000 }, term: 'month-to-month', termMonths: 0 });
    expect(phone.headline.oneTime).toBeUndefined();
  });

  it('maps every term variant with its recurring and one-time price', () => {
    const cable = offerOf(offerCable500);
    expect(cable.variants.map((variant) => variant.termMonths).sort()).toEqual([0, 12, 24]);
    expect(cable.variants.map((variant) => variant.isMaster)).toEqual([true, false, false]);
    const monthToMonth = cable.variants.find((variant) => variant.term === 'month-to-month');
    expect(monthToMonth?.recurringPrice?.centAmount).toBe(6999);
    expect(monthToMonth?.oneTimePrice?.centAmount).toBe(2500);
  });

  it('prices the offer in the buyer market', () => {
    const cable = offerOf(offerCable500, DE);
    expect(cable.headline.recurring).toEqual({ centAmount: 6000, currencyCode: 'EUR' });
    expect(cable.headline.oneTime).toEqual({ centAmount: 2500, currencyCode: 'EUR' });
  });

  it('primaryCategoryKey is the first assigned category', () => {
    const addon = offerOf(offerAddonAppleTv);
    expect(addon.categoryKeys).toEqual(['malva-cat-streaming', 'malva-cat-add-ons']);
    expect(addon.primaryCategoryKey).toBe('malva-cat-streaming');
    expect(offerOf(offerCable500).primaryCategoryKey).toBe('malva-cat-cable-internet');
  });

  it('maps the offer attributes (kind, audience, anchors, relations, existing customer)', () => {
    const cable = offerOf(offerCable500);
    expect(cable).toMatchObject({
      key: 'malva-offer-cable-500',
      kind: 'base-package',
      anchors: ['malva-cable-500'],
      audience: ['consumer', 'small-business', 'employee'],
      existingCustomer: 'any',
      channels: [],
      includedOffers: ['malva-offer-modem-docsis31'],
    });
    expect(cable.conflictsWith).toContain('malva-offer-cable-gig');
    expect(cable.facts).toBeNull();
  });

  it('merges the raw references of the plan (included-addons) with the offer (included-offers)', () => {
    const offer = offerOf(offerPhoneUnlimited);
    expect(offer.includedOffers).toEqual(['malva-offer-spotify']);
    const merged = mergeFacts(offer, { 'malva-phone-unlimited': mapFacts(asProjection(planPhoneUnlimited), 'malva-phone-plan', 'en-US') as OfferFacts });
    expect(merged.includedOffers).toEqual(['malva-offer-spotify', 'malva-spotify']);
    expect(merged.facts).toMatchObject({ kind: 'plan', family: 'phone' });
  });

  it('a missing anchor leaves facts null', () => {
    expect(mergeFacts(offerOf(offerCable500), {}).facts).toBeNull();
  });

  it('the phone plan gets technology mobile; the cable plan keeps its technology', () => {
    const phone = mapPlanFacts(asProjection(planPhoneUnlimited), 'phone', 'en-US');
    expect(phone).toMatchObject({ family: 'phone', technology: 'mobile', dataGb: -1, hotspotGb: 30, linesIncluded: 1, networkGeneration: '5g', badge: 'most-popular', includedAddons: ['malva-spotify'] });
    expect(phone?.highlights).toContain('Unlimited 5G data');
    const cable = mapPlanFacts(asProjection(planCableGig), 'internet', 'en-US');
    expect(cable).toMatchObject({ family: 'internet', technology: 'cable', downstreamMbps: 1000 });
  });

  it('an internet plan without a valid technology is not mapped', () => {
    const plan = asProjection(planCableGig);
    plan.masterVariant.attributes = plan.masterVariant.attributes?.filter((attribute) => attribute.name !== 'technology');
    expect(mapPlanFacts(plan, 'internet', 'en-US')).toBeNull();
  });

  it('maps add-on, equipment and device facts', () => {
    expect(mapAddonFacts(asProjection(addonAppleTv), 'en-US')).toMatchObject({ kind: 'addon', addonKind: 'streaming', provider: 'Apple', tag: 'video', appliesToFamilies: ['internet'], chargeType: 'monthly' });
    expect(mapEquipmentFacts(asProjection(equipmentRouter))).toMatchObject({
      kind: 'equipment',
      equipmentKind: 'router',
      maxDownstreamMbps: 300,
      supportedTechnologies: ['cable', 'fixed-wireless'],
      wifiStandard: 'wifi-5',
      chargeType: 'monthly-rental',
    });
    expect(mapDeviceFacts(asProjection(deviceNova))).toMatchObject({ kind: 'device', brand: 'Malva', os: 'android', networkGeneration: '5g', compatiblePlanFamilies: ['phone'] });
    expect(mapFacts(asProjection(deviceNova), 'malva-unknown', 'en-US')).toBeNull();
  });

  it('a missing attribute never throws', () => {
    const projection = asProjection(offerCable500);
    for (const variant of [projection.masterVariant, ...projection.variants]) {
      variant.attributes = variant.attributes?.filter((attribute) => attribute.name === 'offer-kind');
    }
    const offer = mapOffer(projection, ctx(US));
    expect(offer).toMatchObject({ kind: 'base-package', anchors: [], audience: [], existingCustomer: 'any', channels: [], includedOffers: [] });
    expect(offer?.headline.term).toBeNull();
    const nothing = asProjection(planPhoneUnlimited);
    nothing.masterVariant.attributes = undefined;
    expect(() => mapPlanFacts(nothing, 'phone', 'en-US')).not.toThrow();
    expect(mapPlanFacts(nothing, 'phone', 'en-US')?.highlights).toEqual([]);
  });

  it('drops an offer with an unknown offer-kind', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const projection = asProjection(offerCable500);
    projection.masterVariant.attributes = projection.masterVariant.attributes?.map((attribute) =>
      attribute.name === 'offer-kind' ? { name: 'offer-kind', value: { key: 'mystery', label: 'mystery' } } : attribute,
    );
    expect(mapOffer(projection, ctx(US))).toBeNull();
    expect(warn).toHaveBeenCalledWith('[catalog] offer dropped (unknown offer-kind)', 'malva-offer-cable-500');
    warn.mockRestore();
  });

  it('survives a JSON round trip unchanged', () => {
    const plan = mapFacts(asProjection(planCableGig), 'malva-internet-plan', 'en-US') as OfferFacts;
    for (const fixture of [offerCable500, offerPhoneUnlimited, offerAddonAppleTv, offerRouter, offerDeviceNova]) {
      const offer = mergeFacts(offerOf(fixture), { 'malva-cable-500': plan });
      expect(JSON.parse(JSON.stringify(offer))).toEqual(offer);
    }
  });

  it('localizes to German with an en-US fallback', () => {
    const projection = asProjection(offerCable500);
    expect(mapOffer(projection, ctx(DE))?.description).toMatch(/^Kabel-Internet/);
    delete projection.description?.['de-DE'];
    expect(mapOffer(projection, ctx(DE))?.description).toMatch(/^Cable internet/);
    expect(mapFacts(asProjection(planPhoneUnlimited), 'malva-phone-plan', 'de-DE')).toMatchObject({ highlights: expect.arrayContaining(['Unbegrenzte 5G-Daten']), earlyTerminationFee: 'Keine' });
  });

  it('carries live inventory only for variants that have an inventory entry', () => {
    expect(offerOf(offerRouter).variants[0]?.availableQuantity).toBe(500);
    expect(offerOf(offerCable500).variants[0]?.availableQuantity).toBeUndefined();
  });

  it('a handset keeps its purchase price and lists the financed prices separately', () => {
    const device = offerOf(offerDeviceNova);
    expect(device.kind).toBe('device');
    expect(device.headline.recurring).toBeUndefined();
    expect(device.headline.oneTime?.centAmount).toBe(49900);
    expect(device.variants[0]?.financedPrices?.map((money) => money.centAmount)).toEqual([1386, 1996, 2079, 4158]);
    expect(device.variants[0]?.attributes).toMatchObject({ color: 'black', 'memory-gb': '128', 'charge-type': 'one-time' });
  });
});
