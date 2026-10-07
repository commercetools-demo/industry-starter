import type { Category as SdkCategory, ProductProjection } from '@commercetools/platform-sdk';
import type { Market, Offer } from '@/lib/types';
import categories from './__fixtures__/categories.json';
import offerDeviceNova from './__fixtures__/offer-device-nova-5g.json';
import { mapDeviceOffer } from './device';
import { mapOffer } from './offer';

const US: Market = { locale: 'en-US', currency: 'USD', country: 'US' };
const DE: Market = { locale: 'de-DE', currency: 'EUR', country: 'DE' };
const categoryIdToKey = Object.fromEntries((categories as unknown as SdkCategory[]).map((category) => [category.id, category.key ?? '']));
const offerOf = (market: Market = US): Offer => {
  const offer = mapOffer(structuredClone(offerDeviceNova) as unknown as ProductProjection, { market, categoryIdToKey, now: new Date('2026-10-07T12:00:00Z') });
  if (!offer) throw new Error('fixture offer was dropped');
  return offer;
};

/** Policy id to key, read from the live projection fixture (the price keys end with the policy key). */
const POLICY_KEYS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const projection = offerDeviceNova as unknown as { masterVariant: { prices: { key?: string; recurrencePolicy?: { id: string } }[] } };
  for (const price of projection.masterVariant.prices) if (price.key && price.recurrencePolicy) map[price.recurrencePolicy.id] = price.key.split('_')[2] ?? '';
  return map;
})();

describe('mapDeviceOffer', () => {
  it('Handset is one product with its options as variants: colors and memories are variants of one offer and no mode is a variant', () => {
    const device = mapDeviceOffer(offerOf(), POLICY_KEYS);
    expect(device).not.toBeNull();
    expect(device?.key).toBe('malva-offer-phone-nova-5g');
    expect(device?.colors).toEqual(['black', 'silver']);
    expect(device?.memories).toEqual([128, 256]);
    // 2 colors x 2 memories = 4 variants; the modes outright, installments and lease are prices of each variant, never variants
    expect(device?.variants.map((variant) => `${variant.color}/${variant.memoryGb}`).sort()).toEqual(['black/128', 'black/256', 'silver/128', 'silver/256']);
    expect(device?.variants.every((variant) => !/(outright|installment|lease)/i.test(variant.sku))).toBe(true);
    for (const variant of device?.variants ?? []) {
      expect(variant.prices.outright).toBeDefined();
      expect(Object.keys(variant.prices.installments).length).toBeGreaterThan(0);
    }
  });

  it('puts each price under its mode and term by the key of its policy', () => {
    const master = mapDeviceOffer(offerOf(), POLICY_KEYS)?.variants[0];
    expect(master?.sku).toBe('MLV-DEV-NOVA5G-BLK-128');
    expect(master?.prices.outright).toEqual({ centAmount: 49900, currencyCode: 'USD' });
    expect(Object.keys(master?.prices.installments ?? {}).sort()).toEqual(['12', '24', '36']);
    expect(master?.prices.installments[12]?.centAmount).toBe(4158);
    expect(master?.prices.installments[36]?.centAmount).toBe(1386);
    expect(master?.prices.lease[24]?.centAmount).toBe(1996);
  });

  it('prices the device in the buyer market', () => {
    const master = mapDeviceOffer(offerOf(DE), POLICY_KEYS)?.variants[0];
    expect(master?.prices.outright?.currencyCode).toBe('EUR');
    expect(master?.prices.installments[24]?.currencyCode).toBe('EUR');
  });

  it('ignores a price whose policy is not a device policy and an unknown policy id', () => {
    const device = mapDeviceOffer(offerOf(), { ...POLICY_KEYS, [Object.keys(POLICY_KEYS)[0] as string]: 'malva-monthly' });
    expect(device?.variants[0]?.prices.installments[12]).toBeUndefined();
    expect(mapDeviceOffer(offerOf(), {})?.variants[0]?.prices.installments).toEqual({});
  });

  it('is null for an offer that is not a device and drops variants without a color or memory', () => {
    expect(mapDeviceOffer({ ...offerOf(), kind: 'addon' }, POLICY_KEYS)).toBeNull();
    const broken = offerOf();
    broken.variants = broken.variants.map((variant, index) => (index === 0 ? { ...variant, attributes: {} } : variant));
    expect(mapDeviceOffer(broken, POLICY_KEYS)?.variants).toHaveLength(3);
  });

  it('survives a JSON round trip (it crosses the server/client boundary)', () => {
    const device = mapDeviceOffer(offerOf(), POLICY_KEYS);
    expect(JSON.parse(JSON.stringify(device))).toEqual(device);
  });
});
