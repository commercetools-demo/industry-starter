import { TREE } from './__fixtures__/catalog';
import { canonicalListingPath, categoryHref, categoryPath, languageAlternates, offerAnchorId, offerHref, offerPath, primaryCategoryKey } from './links';

const gig = { key: 'malva-offer-cable-gig', categoryKeys: ['malva-cat-cable-internet'] };

describe('listing links', () => {
  it('Linking to one offer: href is stable across locales (same key, localized slug)', () => {
    expect(offerHref(gig, 'en-US', TREE)).toBe('/en-US/shop/cable-internet?offer=malva-offer-cable-gig#offer-malva-offer-cable-gig');
    expect(offerHref(gig, 'de-DE', TREE)).toBe('/de-DE/shop/kabel-internet?offer=malva-offer-cable-gig#offer-malva-offer-cable-gig');
    expect(offerPath(gig, 'en-US', TREE)).toBe('/shop/cable-internet?offer=malva-offer-cable-gig#offer-malva-offer-cable-gig');
    expect(offerAnchorId(gig.key)).toBe('offer-malva-offer-cable-gig');
  });

  it('Offer in more than one category: link targets the first assigned category', () => {
    const two = { key: 'malva-offer-spotify', categoryKeys: ['malva-cat-streaming', 'malva-cat-add-ons'] };
    expect(primaryCategoryKey(two)).toBe('malva-cat-streaming');
    expect(offerHref(two, 'en-US', TREE)).toBe('/en-US/shop/streaming-entertainment?offer=malva-offer-spotify#offer-malva-offer-spotify');
  });

  it('the mapper\'s primaryCategoryKey wins over the order of categoryKeys', () => {
    expect(primaryCategoryKey({ primaryCategoryKey: 'malva-cat-add-ons', categoryKeys: ['malva-cat-streaming'] })).toBe('malva-cat-add-ons');
  });

  it('an offer whose category is not in the tree has no link', () => {
    expect(offerHref({ key: 'x', categoryKeys: ['malva-cat-gone'] }, 'en-US', TREE)).toBeUndefined();
    expect(offerHref({ key: 'x', categoryKeys: [] }, 'en-US', TREE)).toBeUndefined();
  });

  it('category links use the slug of the locale and work for child categories', () => {
    expect(categoryPath('malva-cat-streaming', 'de-DE', TREE)).toBe('/shop/streaming-unterhaltung');
    expect(categoryHref('malva-cat-add-ons', 'en-US', TREE)).toBe('/en-US/shop/add-ons');
    expect(categoryHref('malva-cat-nope', 'en-US', TREE)).toBeUndefined();
  });

  it('canonical omits the query and page=1', () => {
    expect(canonicalListingPath('en-US', 'add-ons', 1)).toBe('/en-US/shop/add-ons');
    expect(canonicalListingPath('en-US', 'add-ons', 2)).toBe('/en-US/shop/add-ons?page=2');
  });

  it('language alternates carry each locale\'s own slug', () => {
    expect(languageAlternates(TREE[2])).toEqual({ 'en-US': '/en-US/shop/cable-internet', 'de-DE': '/de-DE/shop/kabel-internet' });
  });
});
