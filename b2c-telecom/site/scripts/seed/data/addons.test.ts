import { describe, expect, it } from 'vitest';
import { ADDONS } from './products/addons';
import { masterAttr, nameEn, priceOf, product } from './manifest-access';

describe('add-ons', () => {
  it('the tag filter Music has 2, Video 3 and Extras 3 add-ons', () => {
    const count = (tag: string): number => ADDONS.filter((a) => masterAttr(product(a.key), 'addon-tag') === tag).length;
    expect([count('music'), count('video'), count('extras')]).toEqual([2, 3, 3]);
    // offers carry the copy, so Product Search can filter on it
    const offerCount = (tag: string): number => ADDONS.filter((a) => masterAttr(product(a.key.replace('malva-', 'malva-offer-')), 'addon-tag') === tag).length;
    expect([offerCount('music'), offerCount('video'), offerCount('extras')]).toEqual([2, 3, 3]);
  });

  it('prices are 10, 10, 11, 8, 8, 3, 12, 5 dollars a month', () => {
    const prices = ADDONS.map((a) => priceOf(product(a.key.replace('malva-', 'malva-offer-')).masterVariant, 'USD', 'malva-monthly')?.value.centAmount);
    expect(prices).toEqual([1000, 1000, 1100, 800, 800, 300, 1200, 500]);
    expect(ADDONS.map((a) => nameEn(product(a.key)))).toEqual(['Spotify', 'Apple TV+', 'Apple Music', 'Netflix', 'Disney+', 'Cloud 200GB', 'Device Care', 'Malva Secure']);
  });

  it('families: one internet-only and one phone-only add-on exist', () => {
    expect(masterAttr(product('malva-appletv'), 'applies-to-families')).toEqual(['internet']);
    expect(masterAttr(product('malva-device-protect'), 'applies-to-families')).toEqual(['phone']);
    expect(masterAttr(product('malva-spotify'), 'applies-to-families')).toEqual(['internet', 'phone']);
  });

  it('add-on offers are month-to-month, monthly, and have one variant', () => {
    for (const a of ADDONS) {
      const offer = product(a.key.replace('malva-', 'malva-offer-'));
      expect(offer.variants).toEqual([]);
      expect(masterAttr(offer, 'contract-term')).toBe('month-to-month');
      expect(masterAttr(offer, 'charge-type')).toBe('monthly');
    }
  });
});
