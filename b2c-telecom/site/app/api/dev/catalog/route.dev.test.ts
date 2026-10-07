// @vitest-environment node
import type { Category, Offer } from '@/lib/types';

const root: Category = { id: 'c1', key: 'malva-cat-cable-internet', name: 'Cable internet', slug: 'cable-internet', slugs: {}, children: [] };
const offer = {
  key: 'malva-offer-cable-500',
  name: 'Cable 500',
  kind: 'base-package',
  primaryCategoryKey: root.key,
  facts: { kind: 'plan', downstreamMbps: 500 },
  variants: [{ termMonths: 24 }, { termMonths: 0 }],
  headline: { recurring: { centAmount: 5999, currencyCode: 'USD' }, oneTime: { centAmount: 2500, currencyCode: 'USD' }, termMonths: 24, term: '24-months' },
} as unknown as Offer;

vi.mock('@/lib/ct/categories', () => ({
  getCategoryTree: async () => [root],
  getCategoryByKey: async (key: string) => (key === root.key ? root : null),
}));
vi.mock('@/lib/ct/catalog', () => ({
  getOffersInCategory: async () => [offer],
  getOfferByKey: async (key: string) => (key === offer.key ? offer : null),
}));
vi.mock('@/lib/ct/search', () => ({
  searchOffers: async () => ({ offers: [offer], total: 1, page: 1, pageSize: 12, categoryFacet: [], bandFacet: [] }),
}));

import { GET } from './route.dev';

const get = (query: string) => GET(new Request(`http://localhost/api/dev/catalog?${query}`));

describe('GET /api/dev/catalog', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('outside development the route answers 404', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await get('view=categories')).status).toBe(404);
    vi.stubEnv('NODE_ENV', 'test');
    expect((await get('view=categories')).status).toBe(404);
  });

  describe('in development', () => {
    beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));

    it('an invalid locale gives 400 UNSUPPORTED_LOCALE', async () => {
      const res = await get('view=categories&locale=fr-FR');
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('UNSUPPORTED_LOCALE');
    });

    it('returns the category tree', async () => {
      const body = await (await get('view=categories')).json();
      expect(body.categories[0]).toMatchObject({ key: 'malva-cat-cable-internet', children: [] });
    });

    it('returns reduced offers with a formatted headline label', async () => {
      const body = await (await get('view=offers&category=malva-cat-cable-internet')).json();
      expect(body.offers[0]).toMatchObject({
        key: 'malva-offer-cable-500',
        factsKind: 'plan',
        variantTerms: [24, 0],
        headline: { termMonths: 24, label: '$59.99', oneTime: { centAmount: 2500 } },
      });
      expect(body.chips.map((chip: { id: string }) => chip.id)).toEqual(['all', 'up-to-500', '1-gbps']);
    });

    it('an unknown category gives 404 CATEGORY_NOT_FOUND', async () => {
      const res = await get('view=offers&category=does-not-exist');
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('a single offer, or null with status 200', async () => {
      expect((await (await get('view=offer&key=malva-offer-cable-500')).json()).offer.key).toBe('malva-offer-cable-500');
      const missing = await get('view=offer&key=nope');
      expect(missing.status).toBe(200);
      expect(await missing.json()).toEqual({ offer: null });
    });

    it('search returns the reduced offers and the total', async () => {
      const body = await (await get('view=search&q=cable')).json();
      expect(body.total).toBe(1);
      expect(body.offers[0].key).toBe('malva-offer-cable-500');
    });
  });
});
