// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const search = vi.fn();
const category = vi.fn();
vi.mock('./client', () => ({
  apiRoot: {
    products: () => ({ search: () => ({ post: (a: unknown) => ({ execute: () => search(a) }) }) }),
    categories: () => ({ withKey: () => ({ get: () => ({ execute: () => category() }) }) }),
  },
}));
const { buildSearchRequest, getAllServices, getRelatedServices, getServiceBySlug, getServicesByCategory } = await import('./services');

const proj = (key: string, order: number, name = key) => ({ productProjection: { id: key, key, slug: { 'en-US': key }, name: { 'en-US': name }, categories: [], masterVariant: { id: 1, attributes: [{ name: 'display-order', value: order }, { name: 'related', value: [{ id: 'b' }] }] } } });
beforeEach(() => { search.mockReset(); category.mockReset(); category.mockResolvedValue({ body: { id: 'cat1' } }); process.env.CTP_DEFAULT_STORE_KEY = 'mpw-web'; });

describe('malva-data-loading › Listings use the Product Search API', () => {
  it('Facet-free listing: one search call scoped to the store, with category and sector in the same call', async () => {
    search.mockResolvedValue({ body: { results: [proj('c', 3), proj('a', 1), proj('b', 2)] } });
    const list = await getServicesByCategory('plumbing', 'en-US', 'property');
    expect(search).toHaveBeenCalledTimes(1);
    const req = search.mock.calls[0][0].body;
    expect(req.productProjectionParameters).toMatchObject({ storeProjection: 'mpw-web', priceCurrency: 'USD', priceCountry: 'US', localeProjection: ['en-US'] });
    expect(JSON.stringify(req.query)).toContain('categoriesSubTree');
    expect(JSON.stringify(req.query)).toContain('variants.attributes.sectors.key');
    expect(list.map((s) => s.key)).toEqual(['a', 'b', 'c']);
  });
  it('uses the German locale and EUR', () => {
    expect(buildSearchRequest({ locale: 'de-DE' }).productProjectionParameters).toMatchObject({ priceCurrency: 'EUR', priceCountry: 'DE', localeProjection: ['de-DE'] });
    expect(() => buildSearchRequest({ locale: 'fr-FR' })).toThrow(/Unsupported locale/);
  });
  it('never uses the deprecated projections search', async () => {
    const src = (await import('node:fs')).readFileSync('lib/ct/services.ts', 'utf8');
    expect(src).not.toMatch(/productProjections\(\)/);
  });
});

describe('malva-data-loading › Catalog and marketing data are server-rendered', () => {
  it('Single fetch per request: the slug lookup goes through React cache()', async () => {
    search.mockResolvedValue({ body: { results: [proj('a', 1)] } });
    const s = await getServiceBySlug('a', 'en-US');
    expect(s?.slug).toBe('a');
    expect(JSON.stringify(search.mock.calls[0][0].body.query)).toContain('"slug"');
    expect((await import('node:fs')).readFileSync('lib/ct/services.ts', 'utf8')).toMatch(/export const getServiceBySlug = cache\(/);
  });
  it('Not found: an unknown slug yields null so the page can call notFound()', async () => {
    search.mockResolvedValue({ body: { results: [] } });
    expect(await getServiceBySlug('nope', 'en-US')).toBeNull();
  });
  it('related services come from the full list by id', async () => {
    search.mockResolvedValue({ body: { results: [proj('a', 1), proj('b', 2)] } });
    const all = await getAllServices('en-US');
    expect((await getRelatedServices(all[0], 'en-US')).map((s) => s.key)).toEqual(['b']);
  });
});
