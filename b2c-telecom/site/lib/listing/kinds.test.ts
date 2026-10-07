import { LISTED_ADDONS, LISTED_CABLE_100, LISTED_EQUIPMENT } from './__fixtures__/catalog';
import { countNounFor, listingKindForCategory } from './kinds';

describe('listingKindForCategory', () => {
  it('the three plan categories list plans', () => {
    for (const key of ['malva-cat-cable-internet', 'malva-cat-home-wireless', 'malva-cat-phone-plans']) expect(listingKindForCategory(key, [])).toBe('plans');
  });

  it('add-ons and its three children list add-ons', () => {
    for (const key of ['malva-cat-add-ons', 'malva-cat-streaming', 'malva-cat-protection', 'malva-cat-equipment']) expect(listingKindForCategory(key, [])).toBe('addons');
  });

  it('the devices category lists devices', () => {
    expect(listingKindForCategory('malva-cat-devices', [])).toBe('devices');
  });

  it('a category added later is classified by what its offers are', () => {
    expect(listingKindForCategory('malva-cat-new', [LISTED_CABLE_100])).toBe('plans');
    expect(listingKindForCategory('malva-cat-new', LISTED_ADDONS)).toBe('addons');
    expect(listingKindForCategory('malva-cat-new', [])).toBe('addons');
  });
});

describe('countNounFor', () => {
  it('plans count plans, equipment-only listings count items, the rest add-ons', () => {
    expect(countNounFor('plans', [LISTED_CABLE_100])).toBe('plans');
    expect(countNounFor('addons', LISTED_EQUIPMENT)).toBe('items');
    expect(countNounFor('addons', [...LISTED_ADDONS, ...LISTED_EQUIPMENT])).toBe('addons');
    expect(countNounFor('devices', [])).toBe('devices');
  });
});
