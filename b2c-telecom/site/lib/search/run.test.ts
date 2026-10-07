import { ApiError } from '@/lib/api-error';
import { LISTED_ALL, LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_EXISTING, LISTED_CABLE_GIG, LISTED_ROUTER_AC1200, LISTED_SECURE, LISTED_SPOTIFY, TREE } from '@/lib/listing/__fixtures__/catalog';
import type { Offer } from '@/lib/types';
import { runSearch, type RunSearchDeps } from './run';
import type { SearchParams } from './params';

const params = (change: Partial<SearchParams> = {}): SearchParams => ({ q: 'cable', category: null, sort: 'relevance', page: 1, ...change });
const hit = (offer: Offer, matchedSkus: string[] = []) => ({ id: offer.id, matchedSkus });

function deps(hits: { id: string; matchedSkus: string[] }[], overrides: Partial<RunSearchDeps> = {}, offers: Offer[] = LISTED_ALL): RunSearchDeps {
  return {
    locale: 'en-US',
    tree: TREE,
    languages: ['en-GB', 'de-DE', 'en-US'],
    searchOfferHits: async () => ({ total: hits.length, hits }),
    getOffers: async () => offers,
    ...overrides,
  };
}

describe('runSearch', () => {
  it('Part number pasted: the offer owning the SKU is first and its card shows the matched SKU', async () => {
    const sku = LISTED_CABLE_500.variants[1]?.sku ?? '';
    const view = await runSearch(params({ q: sku.toLowerCase() }), deps([hit(LISTED_CABLE_100), hit(LISTED_CABLE_500, [sku])]));
    expect(view.state).toBe('results');
    expect(view.items[0]).toMatchObject({ offerKey: 'malva-offer-cable-500', matchedSku: sku });
    expect(view.items[1]).toMatchObject({ offerKey: 'malva-offer-cable-100', matchedSku: null });
  });

  it('Query matches nothing: state is none', async () => {
    const view = await runSearch(params({ q: 'zzzzqq' }), deps([]));
    expect(view).toMatchObject({ state: 'none', query: 'zzzzqq', total: 0, items: [] });
  });

  it('Misspelt query: hits from the fuzzy path are returned and no correction text is produced', async () => {
    const view = await runSearch(params({ q: 'Cabel 500' }), deps([hit(LISTED_CABLE_500)]));
    expect(view.state).toBe('results');
    expect(view.query).toBe('Cabel 500');
    expect(Object.keys(view)).not.toContain('correction');
    expect(JSON.stringify(view)).not.toMatch(/did you mean/i);
  });

  it('Unsupported language: reports the language is not supported instead of an empty result', async () => {
    const search = vi.fn();
    const view = await runSearch(params(), deps([], { languages: ['en-GB', 'en-US'], locale: 'de-DE', searchOfferHits: search }));
    expect(view.state).toBe('unsupported-language');
    expect(search).not.toHaveBeenCalled();
  });

  it('a query shorter than two characters is the start state and makes no call', async () => {
    const search = vi.fn();
    const view = await runSearch(params({ q: 'a' }), deps([], { searchOfferHits: search }));
    expect(view.state).toBe('start');
    expect(search).not.toHaveBeenCalled();
  });

  it('an upstream failure is the error state; only the code is logged', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = await runSearch(params({ q: 'secret name' }), deps([], { searchOfferHits: async () => Promise.reject(new ApiError('UPSTREAM_ERROR', 'x')) }));
    expect(view.state).toBe('error');
    expect(spy).toHaveBeenCalledWith('[search] failed', { code: 'UPSTREAM_ERROR' });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret name');
    spy.mockRestore();
  });

  it('counts categories by primary category, in tree order, and filters by one', async () => {
    const hits = [hit(LISTED_CABLE_100), hit(LISTED_SPOTIFY), hit(LISTED_CABLE_500), hit(LISTED_SECURE), hit(LISTED_ROUTER_AC1200)];
    const all = await runSearch(params(), deps(hits));
    expect(all.categories).toEqual([
      { key: 'malva-cat-cable-internet', name: 'Cable internet', count: 2 },
      { key: 'malva-cat-streaming', name: 'Streaming and entertainment', count: 1 },
      { key: 'malva-cat-protection', name: 'Security and protection', count: 1 },
      { key: 'malva-cat-equipment', name: 'Routers and equipment', count: 1 },
    ]);
    expect(all.total).toBe(5);
    const filtered = await runSearch(params({ category: 'malva-cat-cable-internet' }), deps(hits));
    expect(filtered.items.map((item) => item.offerKey)).toEqual(['malva-offer-cable-100', 'malva-offer-cable-500']);
    expect(filtered.categories).toHaveLength(4);
  });

  it('sorts by price with offers without a price last, in both directions', async () => {
    const noPrice: Offer = { ...LISTED_CABLE_GIG, headline: { term: null, termMonths: null }, variants: [] };
    const hits = [hit(noPrice), hit(LISTED_CABLE_500), hit(LISTED_CABLE_100)];
    const offers = [noPrice, LISTED_CABLE_500, LISTED_CABLE_100];
    const asc = await runSearch(params({ sort: 'price-asc' }), deps(hits, {}, offers));
    expect(asc.items.map((item) => item.offerKey)).toEqual(['malva-offer-cable-100', 'malva-offer-cable-500', 'malva-offer-cable-gig']);
    const desc = await runSearch(params({ sort: 'price-desc' }), deps(hits, {}, offers));
    expect(desc.items.map((item) => item.offerKey)).toEqual(['malva-offer-cable-500', 'malva-offer-cable-100', 'malva-offer-cable-gig']);
    expect(asc.items[2]?.fromPrice).toBeNull();
  });

  it('pages by 12 and clamps a page past the end to the last page', async () => {
    const many: Offer[] = Array.from({ length: 30 }, (_, index) => ({ ...LISTED_SPOTIFY, id: `id-x${index}`, key: `malva-offer-x${index}`, anchors: [`a${index}`] }));
    const hits = many.map((offer) => hit(offer));
    const second = await runSearch(params({ q: 'extra', page: 2 }), deps(hits, {}, many));
    expect(second).toMatchObject({ page: 2, pageCount: 3, total: 30 });
    expect(second.items).toHaveLength(12);
    const last = await runSearch(params({ q: 'extra', page: 99 }), deps(hits, {}, many));
    expect(last).toMatchObject({ page: 3, pageCount: 3 });
    expect(last.items).toHaveLength(6);
  });

  it('shows only offers the buyer may see: an offer missing from the visible catalog is dropped, duplicates over one anchor collapse', async () => {
    const visible = LISTED_ALL.filter((offer) => offer.key !== 'malva-offer-cable-500');
    const view = await runSearch(params(), deps([hit(LISTED_CABLE_500), hit(LISTED_CABLE_EXISTING), hit(LISTED_CABLE_100)], {}, visible));
    expect(view.items.map((item) => item.offerKey)).not.toContain('malva-offer-cable-500');
    expect(view.items.map((item) => item.offerKey)).toContain('malva-offer-cable-100');
  });

  it('flags truncation when Product Search reports more matches than it returned', async () => {
    const view = await runSearch(params(), deps([hit(LISTED_CABLE_100)], { searchOfferHits: async () => ({ total: 140, hits: [hit(LISTED_CABLE_100)] }) }));
    expect(view.truncated).toBe(true);
  });

  it('links to the listing anchor of the primary category and carries the first plan highlight', async () => {
    const view = await runSearch(params(), deps([hit(LISTED_CABLE_500)]));
    expect(view.items[0]).toMatchObject({
      href: '/en-US/shop/cable-internet?offer=malva-offer-cable-500#offer-malva-offer-cable-500',
      kind: 'plan',
      categoryName: 'Cable internet',
      fromPrice: { centAmount: 5999, currencyCode: 'USD' },
      fromPriceRecurring: true,
      highlight: 'Fast and reliable',
    });
    expect(view.items[0]?.href).not.toMatch(/\/p\/|\/products\//);
  });
});
