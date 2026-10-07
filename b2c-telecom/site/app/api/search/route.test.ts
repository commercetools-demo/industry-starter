// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { LISTED_ALL, LISTED_CABLE_100, LISTED_CABLE_500, TREE } from '@/lib/listing/__fixtures__/catalog';

const searchOfferHits = vi.fn();
const getSearchLanguages = vi.fn();
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: async () => TREE }));
vi.mock('@/lib/ct/search', () => ({ searchOfferHits: (input: unknown) => searchOfferHits(input), getSearchLanguages: () => getSearchLanguages() }));
vi.mock('@/lib/ct/visible-offers', () => ({ getVisibleOffers: async () => ({ offers: LISTED_ALL, buyer: {}, availability: { state: 'no-location', technologies: [] } }) }));

import { GET } from './route';

const get = (query: string) => GET(new Request(`http://localhost/api/search?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  getSearchLanguages.mockResolvedValue(['en-GB', 'de-DE', 'en-US']);
});

describe('GET /api/search', () => {
  it('answers the results shape with the canonical anchor link', async () => {
    searchOfferHits.mockResolvedValue({ total: 2, hits: [{ id: LISTED_CABLE_500.id, matchedSkus: [] }, { id: LISTED_CABLE_100.id, matchedSkus: [] }] });
    const response = await get('q=cable%20500');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({
      query: 'cable 500',
      state: 'results',
      total: 2,
      truncated: false,
      page: 1,
      pageCount: 1,
      categories: [{ key: 'malva-cat-cable-internet', name: 'Cable internet', count: 2 }],
    });
    expect(body.results[0]).toMatchObject({
      offerKey: 'malva-offer-cable-500',
      categoryKey: 'malva-cat-cable-internet',
      matchedSku: null,
      fromPrice: { centAmount: 5999, currencyCode: 'USD' },
      href: '/en-US/shop/cable-internet?offer=malva-offer-cable-500#offer-malva-offer-cable-500',
    });
  });

  it('an empty result is HTTP 200 with state none', async () => {
    searchOfferHits.mockResolvedValue({ total: 0, hits: [] });
    const response = await get('q=zzzzqq');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: 'none', total: 0, results: [] });
  });

  it('a one-character query is the start state and does not search', async () => {
    const response = await get('q=a');
    expect(await response.json()).toMatchObject({ state: 'start', results: [] });
    expect(searchOfferHits).not.toHaveBeenCalled();
  });

  it('an upstream failure answers 502 with the shared error body', async () => {
    searchOfferHits.mockRejectedValue(new ApiError('UPSTREAM_ERROR', 'x'));
    const response = await get('q=cable');
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('UPSTREAM_ERROR');
  });

  it('cuts a q of 101 characters to 100', async () => {
    searchOfferHits.mockResolvedValue({ total: 0, hits: [] });
    const body = await (await get(`q=${'a'.repeat(101)}`)).json();
    expect(body.query).toHaveLength(100);
    expect(searchOfferHits).toHaveBeenCalledWith({ text: 'a'.repeat(100), locale: 'en-US' });
  });

  it('searches in the requested locale', async () => {
    searchOfferHits.mockResolvedValue({ total: 0, hits: [] });
    await get('q=tarif&locale=de-DE');
    expect(searchOfferHits).toHaveBeenCalledWith({ text: 'tarif', locale: 'de-DE' });
  });
});
