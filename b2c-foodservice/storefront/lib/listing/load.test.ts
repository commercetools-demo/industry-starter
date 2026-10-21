// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from 'use-intl';
import enUS from '@/messages/en-US.json';
import enCA from '@/messages/en-CA.json';

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({ locale, messages: locale === 'en-CA' ? enCA : enUS, namespace } as never),
}));

const ct = vi.hoisted(() => ({
  languages: ['en-US', 'en-CA'],
  searchBodies: [] as Record<string, unknown>[],
  searchReplies: [] as Record<string, unknown>[],
  projections: [] as Record<string, unknown>[],
  session: {} as Record<string, string>,
  projectionCalls: 0,
}));
const cat = (id: string, key: string, slug: string, name: string, parent?: string, orderHint = '0.1') => ({
  id, key, name: { 'en-US': name, 'en-CA': name }, slug: { 'en-US': slug, 'en-CA': slug }, orderHint,
  ...(parent ? { parent: { typeId: 'category', id: parent } } : {}),
});
const CATEGORIES = [
  cat('c-pods', 'mcf-cat-pods', 'pods', 'Pods'),
  cat('c-orig', 'mcf-cat-pods-original', 'pods-original', 'Original', 'c-pods'),
  cat('c-coffee', 'mcf-cat-coffee', 'coffee', 'Coffee', undefined, '0.2'),
];
const STORE = { id: 'chan-1', key: 'mcf-store-nyc-soho', roles: ['InventorySupply'], name: { 'en-US': 'Malva SoHo' }, address: { country: 'US' }, custom: { fields: {} } };

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    get: () => ({ execute: async () => ({ body: { languages: ct.languages, countries: ['US', 'CA'], currencies: ['USD', 'CAD'] } }) }),
    categories: () => ({ get: () => ({ execute: async () => ({ body: { results: CATEGORIES } }) }) }),
    channels: () => ({ get: () => ({ execute: async () => ({ body: { results: [STORE] } }) }) }),
    productTypes: () => ({ get: () => ({ execute: async () => ({ body: { results: [] } }) }) }),
    products: () => ({
      search: () => ({
        post: ({ body }: { body: Record<string, unknown> }) => ({
          execute: async () => {
            ct.searchBodies.push(body);
            const next = ct.searchReplies.shift();
            if (next instanceof Error) throw next;
            return { body: next ?? { total: 0, results: [], facets: [] } };
          },
        }),
      }),
    }),
    productProjections: () => ({
      get: () => ({ execute: async () => { ct.projectionCalls += 1; return { body: { results: ct.projections } }; } }),
    }),
  },
}));
vi.mock('@/lib/session', () => ({ getSession: async () => ct.session }));

import { loadCount, loadListing, type ListingView } from '@/lib/listing/load';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const projection = (n: number, name: string, extra: Record<string, unknown> = {}) => ({
  id: ID(n), name: { 'en-US': name }, slug: { 'en-US': name.toLowerCase() }, categories: [{ typeId: 'category', id: 'c-orig' }],
  attributes: [], variants: [],
  masterVariant: { id: 1, sku: `SKU-${n}`, images: [], attributes: [], price: { id: 'p', value: { currencyCode: 'USD', centAmount: 490 } } },
  ...extra,
});
const reply = (total: number, ids: number[], facets: unknown[] = [], extra: unknown[] = []) => ({
  total, results: ids.map((n, i) => ({ id: ID(n), ...((extra[i] as object) ?? {}) })), facets,
});
const ok = (r: Awaited<ReturnType<typeof loadListing>>): ListingView => {
  if (r.kind !== 'ok') throw new Error(`expected ok, got ${r.kind}`);
  return r;
};

beforeEach(() => {
  ct.languages = ['en-US', 'en-CA'];
  ct.searchBodies = [];
  ct.searchReplies = [];
  ct.projections = [];
  ct.session = {};
  ct.projectionCalls = 0;
});

describe('loadListing', () => {
  it('Browse a category shows a paginated filterable list', async () => {
    ct.searchReplies = [reply(50, [1, 2], [{ name: 'intensity', buckets: [{ key: '8', count: 3 }] }])];
    ct.projections = [projection(1, 'Ember'), projection(2, 'Casa')];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'category', slug: 'pods', searchParams: {} }));
    expect(v.crumbs.map((c) => c.label)).toEqual(['Home', 'Pods']);
    expect(v.crumbs.at(-1)?.href).toBeUndefined();
    expect(v.items.map((i) => i.name)).toEqual(['Ember', 'Casa']);
    expect(v.pageCount).toBe(3);
    expect(v.apiScope).toBe('mcf-cat-pods');
    expect(JSON.stringify(ct.searchBodies[0]!.query)).toContain('c-pods');
    expect(v.groups.find((g) => g.name === 'intensity')?.options.find((o) => o.value === '8')?.count).toBe(3);
  });

  it('Filters survive a reload (same URL gives same state and count)', async () => {
    const sp = { f_roast: 'dark', sort: 'rating', page: '2' };
    ct.searchReplies = [reply(30, [1], [{ name: 'roast', buckets: [{ key: 'dark', count: 30 }] }])];
    ct.projections = [projection(1, 'Ember')];
    const first = ok(await loadListing({ locale: 'en-US', scope: 'shop', searchParams: sp }));
    ct.searchReplies = [reply(30, [1], [{ name: 'roast', buckets: [{ key: 'dark', count: 30 }] }])];
    const again = ok(await loadListing({ locale: 'en-US', scope: 'shop', searchParams: sp }));
    expect(again.params).toEqual(first.params);
    expect(again.total).toBe(first.total);
    expect(first.params).toMatchObject({ facets: { roast: ['dark'] }, sort: 'rating', page: 2 });
    expect(first.chips.map((c) => [c.label, c.href])).toEqual([['Dark', '/shop?sort=rating']]);
  });

  it('Facet combination with no matches keeps removable chips', async () => {
    ct.searchReplies = [reply(0, [], [{ name: 'roast', buckets: [{ key: 'dark', count: 0 }] }])];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'shop', searchParams: { f_roast: 'dark', f_decaf: 'true' } }));
    expect(v.total).toBe(0);
    expect(v.chips.map((c) => c.key)).toEqual(['roast:dark', 'decaf:true']);
    expect(v.chips.find((c) => c.key === 'roast:dark')?.href).toBe('/shop?f_decaf=true');
    expect(v.clearAllHref).toBe('/shop');
    expect(v.noResults).toBeUndefined();
    expect(ct.projectionCalls).toBe(0);
  });

  it('Page past the last result redirects to the last page', async () => {
    ct.searchReplies = [reply(30, []), reply(30, [1])];
    const r = await loadListing({ locale: 'en-US', scope: 'shop', searchParams: { page: '9', f_roast: 'dark' } });
    expect(r).toEqual({ kind: 'redirect', href: '/shop?f_roast=dark&page=2' });
  });

  it('Query matches nothing keeps the query and offers fallback content', async () => {
    ct.searchReplies = [reply(0, []), reply(4, [1])];
    ct.projections = [projection(1, 'Ember')];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'search', searchParams: { q: 'zzzzqq' } }));
    expect(v.total).toBe(0);
    expect(v.params.q).toBe('zzzzqq');
    expect(v.noResults?.categories.map((c) => c.name)).toEqual(['Pods', 'Coffee']);
    expect(v.noResults?.bestsellers.map((b) => b.name)).toEqual(['Ember']);
    expect(JSON.stringify(ct.searchBodies[1]!.postFilter)).toContain('bestseller');
    expect(ct.searchBodies[1]!.limit).toBe(4);
  });

  it('Misspelt query sends a fuzzy clause and claims no correction', async () => {
    ct.searchReplies = [reply(1, [1])];
    ct.projections = [projection(1, 'Ethiopia Yirgacheffe')];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'search', searchParams: { q: 'yirgachefe' } }));
    expect(JSON.stringify(ct.searchBodies[0]!.query)).toContain('"fuzzy"');
    expect(JSON.stringify(v)).not.toMatch(/did you mean/i);
  });

  it('Part number pasted puts that product first and names the matched sku', async () => {
    ct.searchReplies = [reply(2, [2, 1], [], [{ matchingVariants: { allMatched: false, matchedVariants: [{ id: 2, sku: 'MCF-POD-EMBER-50' }] } }, {}])];
    ct.projections = [projection(1, 'Casa'), projection(2, 'Ember')];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'search', searchParams: { q: 'mcf-pod-ember-50' } }));
    expect(v.items.map((i) => i.name)).toEqual(['Ember', 'Casa']);
    expect(v.items[0]!.matchedSku).toBe('MCF-POD-EMBER-50');
    expect(v.items[1]!.matchedSku).toBeUndefined();
  });

  it('Unsupported language reports it', async () => {
    ct.languages = ['en-US'];
    expect(await loadListing({ locale: 'en-CA', scope: 'shop', searchParams: {} })).toEqual({ kind: 'unsupported_language' });
    expect(ct.searchBodies).toHaveLength(0);
  });

  it('unknown category 404', async () => {
    await expect(loadListing({ locale: 'en-US', scope: 'category', slug: 'nope', searchParams: {} })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('an empty category without filters is a 404, with a filter it is an empty state', async () => {
    ct.searchReplies = [reply(0, [])];
    await expect(loadListing({ locale: 'en-US', scope: 'category', slug: 'coffee', searchParams: {} })).rejects.toThrow('NEXT_NOT_FOUND');
    ct.searchReplies = [reply(0, [])];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'category', slug: 'coffee', searchParams: { f_roast: 'dark' } }));
    expect(v.total).toBe(0);
  });

  it('Category change resets filters', async () => {
    ct.searchReplies = [reply(1, [1]), reply(1, [1])];
    ct.projections = [projection(1, 'Ember')];
    const a = ok(await loadListing({ locale: 'en-US', scope: 'category', slug: 'pods', searchParams: { f_roast: 'dark', page: '2' } }));
    const b = ok(await loadListing({ locale: 'en-US', scope: 'category', slug: 'coffee', searchParams: {} }));
    expect(a.chips).toHaveLength(1);
    expect(b.chips).toHaveLength(0);
    expect(b.params.page).toBe(1);
    expect(b.basePath).toBe('/category/coffee');
  });

  it('empty q shows the prompt and no search call', async () => {
    const r = await loadListing({ locale: 'en-US', scope: 'search', searchParams: { q: '  ' } });
    expect(r.kind).toBe('prompt');
    expect(ct.searchBodies).toHaveLength(0);
  });

  it('a chosen store feeds availability and the avail filter; Canada has no store', async () => {
    ct.session = { collectionStoreKey: 'mcf-store-nyc-soho' };
    ct.searchReplies = [reply(1, [1])];
    ct.projections = [projection(1, 'Ember', { masterVariant: { id: 1, sku: 'S', images: [], attributes: [], price: { id: 'p', value: { currencyCode: 'USD', centAmount: 490 } }, availability: { channels: { 'chan-1': { isOnStock: true, availableQuantity: 2 } } } } })];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'shop', searchParams: { avail: '1' } }));
    expect(v.store).toEqual({ key: 'mcf-store-nyc-soho', name: 'Malva SoHo' });
    expect(v.items[0]!.availability).toEqual({ state: 'low' });
    expect(JSON.stringify(ct.searchBodies[0]!.query)).toContain('isOnStockForChannel');
    expect(v.chips.map((c) => c.label)).toEqual(['Available at Malva SoHo']);
    ct.searchReplies = [reply(1, [1])];
    const ca = ok(await loadListing({ locale: 'en-CA', scope: 'shop', searchParams: { avail: '1' } }));
    expect(ca.store).toBeNull();
    expect(JSON.stringify(ct.searchBodies[1]!.query)).not.toContain('isOnStockForChannel');
  });

  it('search sort options start with Best match, shop with Featured', async () => {
    ct.searchReplies = [reply(1, [1]), reply(1, [1])];
    ct.projections = [projection(1, 'Ember')];
    const s = ok(await loadListing({ locale: 'en-US', scope: 'search', searchParams: { q: 'ember' } }));
    expect(s.sortOptions.map((o) => o.label)).toEqual(['Best match', 'Price: low to high', 'Price: high to low', 'Top rated']);
    const shop = ok(await loadListing({ locale: 'en-US', scope: 'shop', searchParams: {} }));
    expect(shop.sortOptions[0]!.label).toBe('Featured');
    expect(shop.sortOptions[1]!.href).toBe('/shop?sort=price-asc');
  });

  it('facet failure still renders the grid', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    ct.searchReplies = [new Error('facets unsupported') as never, reply(1, [1])];
    ct.projections = [projection(1, 'Ember')];
    const v = ok(await loadListing({ locale: 'en-US', scope: 'shop', searchParams: {} }));
    expect(v.facetsFailed).toBe(true);
    expect(v.items).toHaveLength(1);
    expect(v.groups).toEqual([]);
    expect(ct.searchBodies[0]!.facets).toBeDefined();
    expect(ct.searchBodies[1]!.facets).toBeUndefined();
    quiet.mockRestore();
  });
});

describe('loadCount', () => {
  it('counts a category by key with limit 0 and no facets', async () => {
    ct.searchReplies = [{ total: 7, results: [] }];
    const out = await loadCount({ locale: 'en-US', scopeParam: 'mcf-cat-pods', searchParams: { f_roast: 'dark' } });
    expect(out).toEqual({ total: 7 });
    expect(ct.searchBodies[0]).toMatchObject({ limit: 0 });
    expect(ct.searchBodies[0]!.facets).toBeUndefined();
    expect(JSON.stringify(ct.searchBodies[0]!.query)).toContain('c-pods');
  });
  it('unknown scope and unsupported language', async () => {
    expect(await loadCount({ locale: 'en-US', scopeParam: 'mcf-cat-nope', searchParams: {} })).toEqual({ status: 'unknown_scope' });
    ct.languages = ['en-US'];
    expect(await loadCount({ locale: 'en-CA', scopeParam: 'shop', searchParams: {} })).toEqual({ status: 'unsupported_language' });
  });
});
