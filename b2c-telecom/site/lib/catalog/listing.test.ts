import type { Category, Offer, OfferFacts } from '@/lib/types';
import { buildListing, chipsFor } from './listing';

const category = (key: string, name: string, slug: string, children: Category[] = []): Category => ({ id: key, key, name, slug, slugs: {}, children });
const roots: Category[] = [
  category('malva-cat-phone-plans', 'Phone plans', 'phone-plans'),
  category('malva-cat-home-wireless', 'Wireless internet', 'home-wireless-internet'),
  category('malva-cat-cable-internet', 'Cable internet', 'cable-internet'),
  category('malva-cat-add-ons', 'Add-ons', 'add-ons', [category('malva-cat-streaming', 'Streaming', 'streaming')]),
  category('malva-cat-devices', 'Phones & devices', 'phones-and-devices'),
];

function offer(key: string, centAmount: number, facts: OfferFacts | null, extra: Partial<Offer> = {}): Offer {
  return {
    id: key,
    key,
    kind: 'base-package',
    name: key,
    slug: key,
    description: '',
    categoryKeys: [],
    anchors: [],
    facts,
    includedOffers: [],
    compatibleAddons: [],
    compatibleEquipment: [],
    conflictsWith: [],
    audience: [],
    existingCustomer: 'any',
    channels: [],
    variants: [],
    headline: { recurring: { centAmount, currencyCode: 'USD' }, term: null, termMonths: null },
    ...extra,
  };
}
const plan = (facts: Partial<Extract<OfferFacts, { kind: 'plan' }>>): OfferFacts => ({
  kind: 'plan',
  family: 'phone',
  technology: 'mobile',
  includedAddons: [],
  conflictsWith: [],
  requiredEquipmentKinds: [],
  requiredAddonKinds: [],
  highlights: [],
  ...facts,
});
const addon = (tag: string): OfferFacts => ({ kind: 'addon', addonKind: 'streaming', appliesToFamilies: [], appliesToTechnologies: [], tag, highlights: [] });

const phonePlans = [
  offer('unlimited-max', 6500, plan({ dataGb: -1 })),
  offer('essential', 2500, plan({ dataGb: 5 })),
  offer('unlimited', 5000, plan({ dataGb: -1 })),
  offer('plus', 3500, plan({ dataGb: 20 })),
];
const cablePlans = [
  offer('cable-gig', 7999, plan({ family: 'internet', technology: 'cable', downstreamMbps: 1000 })),
  offer('cable-100', 3999, plan({ family: 'internet', technology: 'cable', downstreamMbps: 100 })),
  offer('cable-500', 5999, plan({ family: 'internet', technology: 'cable', downstreamMbps: 500 })),
];
const thirty = Array.from({ length: 30 }, (_, index) => offer(`offer-${String(index + 1).padStart(2, '0')}`, 1000 + index * 100, plan({ dataGb: index })));
const ids = (offers: Offer[]) => offers.map((entry) => entry.key);

describe('buildListing', () => {
  it('Browse a category: page 1 holds 12 offers priced in the buyer\'s market, chip filter applied, counts over the whole category', () => {
    const result = buildListing(thirty, 'malva-cat-phone-plans', { chip: 'data-capped' }, roots);
    expect(result.offers).toHaveLength(12);
    expect(result.offers.every((entry) => entry.headline.recurring?.currencyCode === 'USD')).toBe(true);
    expect(result).toMatchObject({ total: 30, page: 1, pageSize: 12, pageCount: 3 });
    const unlimited = buildListing(phonePlans, 'malva-cat-phone-plans', { chip: 'unlimited' }, roots);
    expect(ids(unlimited.offers)).toEqual(['unlimited', 'unlimited-max']);
    expect(unlimited.chips).toEqual([
      { id: 'all', count: 4 },
      { id: 'unlimited', count: 2 },
      { id: 'data-capped', count: 2 },
    ]);
    expect(unlimited.empty).toBeUndefined();
  });

  it('Nothing matches: a chip with no result returns empty \'no-match\' and the root categories for recovery', () => {
    const result = buildListing(cablePlans, 'malva-cat-cable-internet', { band: 'lt-25' }, roots);
    expect(result).toMatchObject({ empty: 'no-match', offers: [], total: 0 });
    expect(result.recoveryLinks?.map((link) => link.key)).toEqual(roots.map((root) => root.key));
    const noChipMatch = buildListing([cablePlans[1] as Offer], 'malva-cat-cable-internet', { chip: '1-gbps' }, roots);
    expect(noChipMatch.empty).toBe('no-match');
    expect(noChipMatch.recoveryLinks).toHaveLength(5);
  });

  it('Nothing matches: a category without offers returns empty \'no-offers\'', () => {
    const result = buildListing([], 'malva-cat-devices', {}, roots);
    expect(result).toMatchObject({ empty: 'no-offers', offers: [], total: 0, page: 1, pageCount: 1 });
    expect(result.recoveryLinks).toHaveLength(5);
  });

  it('cable chips split at 500 Mbps (D-017): up to 500 and 1 Gbps', () => {
    const upTo500 = buildListing(cablePlans, 'malva-cat-cable-internet', { chip: 'up-to-500' }, roots);
    expect(ids(upTo500.offers)).toEqual(['cable-100', 'cable-500']);
    expect(ids(buildListing(cablePlans, 'malva-cat-cable-internet', { chip: '1-gbps' }, roots).offers)).toEqual(['cable-gig']);
    expect(upTo500.chips).toEqual([
      { id: 'all', count: 3 },
      { id: 'up-to-500', count: 2 },
      { id: '1-gbps', count: 1 },
    ]);
  });

  it('wireless chips split by network generation', () => {
    const wireless = [
      offer('air-lite', 4500, plan({ family: 'internet', technology: 'fixed-wireless', networkGeneration: '4g' })),
      offer('air-5g', 5500, plan({ family: 'internet', technology: 'fixed-wireless', networkGeneration: '5g' })),
      offer('air-5g-plus', 7500, plan({ family: 'internet', technology: 'fixed-wireless', networkGeneration: '5g' })),
    ];
    expect(ids(buildListing(wireless, 'malva-cat-home-wireless', { chip: 'lte' }, roots).offers)).toEqual(['air-lite']);
    expect(ids(buildListing(wireless, 'malva-cat-home-wireless', { chip: '5g' }, roots).offers)).toEqual(['air-5g', 'air-5g-plus']);
  });

  it('add-on chips use the tag and apply to the child categories of the add-ons root', () => {
    const addons = [offer('spotify', 1000, addon('music')), offer('appletv', 1000, addon('video')), offer('cloud', 500, addon('extras')), offer('router', 500, null)];
    expect(chipsFor('malva-cat-streaming', roots)).toEqual(['all', 'music', 'video', 'extras']);
    expect(ids(buildListing(addons, 'malva-cat-streaming', { chip: 'music' }, roots).offers)).toEqual(['spotify']);
    expect(ids(buildListing(addons, 'malva-cat-add-ons', { chip: 'video' }, roots).offers)).toEqual(['appletv']);
    expect(chipsFor('malva-cat-devices', roots)).toEqual(['all']);
  });

  it('an unknown chip behaves as all', () => {
    expect(buildListing(cablePlans, 'malva-cat-cable-internet', { chip: 'nope' }, roots).total).toBe(3);
    expect(buildListing(cablePlans, 'malva-cat-cable-internet', { chip: 'music' }, roots).total).toBe(3);
  });

  it('sorts by ascending headline price by default, descending or by name on request', () => {
    expect(ids(buildListing(phonePlans, 'malva-cat-phone-plans', {}, roots).offers)).toEqual(['essential', 'plus', 'unlimited', 'unlimited-max']);
    expect(ids(buildListing(phonePlans, 'malva-cat-phone-plans', { sort: 'price-desc' }, roots).offers)).toEqual(['unlimited-max', 'unlimited', 'plus', 'essential']);
    expect(ids(buildListing(phonePlans, 'malva-cat-phone-plans', { sort: 'name' }, roots).offers)).toEqual(['essential', 'plus', 'unlimited', 'unlimited-max']);
  });

  it('puts one-time-only offers after the monthly ones', () => {
    const oneTimeOnly = offer('handset', 100, null, { headline: { oneTime: { centAmount: 100, currencyCode: 'USD' }, term: null, termMonths: null } });
    expect(ids(buildListing([oneTimeOnly, ...phonePlans], 'malva-cat-phone-plans', {}, roots).offers).at(-1)).toBe('handset');
    expect(ids(buildListing([oneTimeOnly, ...phonePlans], 'malva-cat-phone-plans', { sort: 'price-desc' }, roots).offers).at(-1)).toBe('handset');
  });

  it('price band edges: 2500 belongs to 25-50', () => {
    expect(ids(buildListing(phonePlans, 'malva-cat-phone-plans', { band: '25-50' }, roots).offers)).toEqual(['essential', 'plus']);
    const result = buildListing(phonePlans, 'malva-cat-phone-plans', {}, roots);
    expect(result.bands).toEqual([
      { id: 'lt-25', count: 0 },
      { id: '25-50', count: 2 },
      { id: '50-75', count: 2 },
      { id: 'gt-75', count: 0 },
    ]);
  });

  it('paginates: page 2 holds items 13-24 and page 9 clamps to 3', () => {
    const page2 = buildListing(thirty, 'malva-cat-phone-plans', { page: 2, sort: 'name' }, roots);
    expect(page2.offers.map((entry) => entry.key)).toEqual(thirty.slice(12, 24).map((entry) => entry.key));
    const page9 = buildListing(thirty, 'malva-cat-phone-plans', { page: 9, sort: 'name' }, roots);
    expect(page9).toMatchObject({ page: 3, pageCount: 3 });
    expect(page9.offers).toHaveLength(6);
    expect(buildListing(thirty, 'malva-cat-phone-plans', { page: 0 }, roots).page).toBe(1);
  });
});
