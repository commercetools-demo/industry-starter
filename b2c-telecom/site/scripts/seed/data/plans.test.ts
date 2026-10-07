import { describe, expect, it } from 'vitest';
import { masterAttr, nameEn, priceOf, product } from './manifest-access';

const offerPrice = (key: string): number | undefined => priceOf(product(key).masterVariant, 'USD', 'malva-monthly')?.value.centAmount;

describe('cable and wireless plans (design prototype data)', () => {
  const cable: [string, string, number, string, [number, number, number]][] = [
    ['malva-cable-100', 'Cable 100', 3999, 'MLV-CA-100', [104, 11, 16]],
    ['malva-cable-500', 'Cable 500', 5999, 'MLV-CA-101', [525, 48, 13]],
    ['malva-cable-gig', 'Cable Gig', 7999, 'MLV-CA-102', [940, 60, 11]],
  ];
  const wireless: [string, string, number, string, [number, number, number]][] = [
    ['malva-wireless-lite', 'Air Lite', 4500, 'MLV-WI-100', [42, 8, 45]],
    ['malva-wireless-5g', 'Air 5G', 5500, 'MLV-WI-101', [190, 25, 30]],
    ['malva-wireless-5g-plus', 'Air 5G Plus', 7500, 'MLV-WI-102', [470, 60, 22]],
  ];

  it.each([...cable, ...wireless])('%s: name, master price, label id and typical speeds equal the prototype', (key, name, usd, labelId, typical) => {
    const plan = product(key);
    const offer = product(key.replace('malva-', 'malva-offer-'));
    expect(nameEn(plan)).toBe(name);
    expect(nameEn(offer)).toBe(name);
    expect(offerPrice(offer.key)).toBe(usd);
    expect(masterAttr(plan, 'label-plan-id')).toBe(labelId);
    expect([masterAttr(plan, 'typical-download-mbps'), masterAttr(plan, 'typical-upload-mbps'), masterAttr(plan, 'typical-latency-ms')]).toEqual(typical);
  });

  it('activation fee is 25 for cable and 0 for wireless, and cable carries it as a one-time price too', () => {
    for (const [key] of cable) {
      expect(masterAttr(product(key), 'activation-fee')).toBe(25);
      const offer = product(key.replace('malva-', 'malva-offer-'));
      for (const v of [offer.masterVariant, ...offer.variants]) {
        expect(priceOf(v, 'USD')?.value.centAmount).toBe(2500);
        expect(priceOf(v, 'EUR')?.value.centAmount).toBe(2500);
        expect(priceOf(v, 'USD')?.recurrencePolicy).toBeUndefined();
      }
    }
    for (const [key] of wireless) {
      expect(masterAttr(product(key), 'activation-fee')).toBe(0);
      const offer = product(key.replace('malva-', 'malva-offer-'));
      expect(offer.masterVariant.prices.every((p) => p.recurrencePolicy === 'malva-monthly')).toBe(true);
    }
  });

  it('price lock is 24 months for cable and 12 for wireless; the term is on the descriptive plan', () => {
    expect(masterAttr(product('malva-cable-500'), 'price-lock-months')).toBe(24);
    expect(masterAttr(product('malva-cable-500'), 'contract-term')).toBe('24-months');
    expect(masterAttr(product('malva-wireless-5g'), 'price-lock-months')).toBe(12);
    expect(masterAttr(product('malva-wireless-5g'), 'contract-term')).toBe('12-months');
  });

  it('early termination fee: cable "$10 x months remaining", wireless "$0"', () => {
    expect(masterAttr(product('malva-cable-500'), 'early-termination-fee')).toEqual({ 'en-US': '$10 x months remaining', 'de-DE': '10 € x verbleibende Monate' });
    expect(masterAttr(product('malva-wireless-lite'), 'early-termination-fee')).toEqual({ 'en-US': '$0', 'de-DE': '0 €' });
  });

  it('Air Lite is LTE and the other wireless plans are 5G (D-017)', () => {
    expect(masterAttr(product('malva-wireless-lite'), 'network-generation')).toBe('4g');
    expect(masterAttr(product('malva-wireless-5g'), 'network-generation')).toBe('5g');
    expect(masterAttr(product('malva-wireless-lite'), 'data-gb')).toBe(300);
  });

  it('Cable Gig includes Apple TV+ and every cable plan needs a modem, wireless a gateway', () => {
    expect(masterAttr(product('malva-cable-gig'), 'included-addons')).toEqual(['malva-appletv']);
    expect(masterAttr(product('malva-cable-100'), 'required-equipment-kinds')).toEqual(['modem']);
    expect(masterAttr(product('malva-wireless-5g'), 'required-equipment-kinds')).toEqual(['gateway']);
  });
});

describe('phone plans (design prototype data)', () => {
  it('phone prices are 25, 35, 50, 65 on the month-to-month master', () => {
    const keys = ['malva-offer-phone-essential', 'malva-offer-phone-plus', 'malva-offer-phone-unlimited', 'malva-offer-phone-unlimited-max'];
    expect(keys.map(offerPrice)).toEqual([2500, 3500, 5000, 6500]);
    for (const key of keys) expect(masterAttr(product(key), 'contract-term')).toBe('month-to-month');
  });

  it('early termination fee is None, hotspot values and per-line semantics', () => {
    const plans = ['malva-phone-essential', 'malva-phone-plus', 'malva-phone-unlimited', 'malva-phone-unlimited-max'];
    expect(plans.map((k) => masterAttr(product(k), 'hotspot-gb'))).toEqual([0, 10, 30, -1]);
    expect(plans.map((k) => masterAttr(product(k), 'data-gb'))).toEqual([5, 20, -1, -1]);
    for (const k of plans) {
      expect(masterAttr(product(k), 'early-termination-fee')).toEqual({ 'en-US': 'None', 'de-DE': 'Keine' });
      expect(masterAttr(product(k), 'lines-included')).toBe(1);
    }
  });

  it('names equal the design and the label ids run MLV-PH-100 to 103', () => {
    expect(['malva-phone-essential', 'malva-phone-plus', 'malva-phone-unlimited', 'malva-phone-unlimited-max'].map((k) => nameEn(product(k)))).toEqual(['Essential 5GB', 'Plus 20GB', 'Unlimited', 'Unlimited Max']);
    expect(['malva-phone-essential', 'malva-phone-plus', 'malva-phone-unlimited', 'malva-phone-unlimited-max'].map((k) => masterAttr(product(k), 'label-plan-id'))).toEqual(['MLV-PH-100', 'MLV-PH-101', 'MLV-PH-102', 'MLV-PH-103']);
  });

  it('the included add-ons: Unlimited has Spotify, Max has Spotify and Cloud', () => {
    expect(masterAttr(product('malva-phone-unlimited'), 'included-addons')).toEqual(['malva-spotify']);
    expect(masterAttr(product('malva-phone-unlimited-max'), 'included-addons')).toEqual(['malva-spotify', 'malva-cloud-200']);
  });
});
