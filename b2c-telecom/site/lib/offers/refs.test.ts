import { offerKeyForProduct, refersTo } from './refs';

const appletv = { key: 'malva-offer-appletv', anchors: ['malva-appletv'], variants: [{ sku: 'MLV-ADD-APPLETV-MTH' }] } as Parameters<typeof refersTo>[1];

describe('refersTo', () => {
  it('resolves an offer key, a product key and a SKU to the same offer', () => {
    expect(refersTo('malva-offer-appletv', appletv)).toBe(true);
    expect(refersTo('malva-appletv', appletv)).toBe(true);
    expect(refersTo('MLV-ADD-APPLETV-MTH', appletv)).toBe(true);
  });

  it('does not resolve an unrelated key', () => {
    expect(refersTo('malva-offer-spotify', appletv)).toBe(false);
    expect(refersTo('malva-spotify', appletv)).toBe(false);
    expect(refersTo('MLV-ADD-SPOTIFY-MTH', appletv)).toBe(false);
  });

  it('an offer key matches only that offer even when another offer anchors the same product', () => {
    const sibling = { key: 'malva-offer-cable-existing-customer', anchors: ['malva-cable-500'], variants: [] };
    const cable500 = { key: 'malva-offer-cable-500', anchors: ['malva-cable-500'], variants: [] };
    expect(refersTo('malva-offer-cable-500', sibling)).toBe(false);
    expect(refersTo('malva-cable-500', sibling)).toBe(true);
    expect(refersTo('malva-cable-500', cable500)).toBe(true);
  });
});

describe('offerKeyForProduct', () => {
  it('replaces the product prefix with the offer prefix', () => {
    expect(offerKeyForProduct('malva-appletv')).toBe('malva-offer-appletv');
  });
});
