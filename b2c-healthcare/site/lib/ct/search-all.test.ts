// @vitest-environment node
import type { ProductProjection } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchProducts = vi.fn();
vi.mock('@/lib/ct/search', () => ({ searchProducts: (...a: unknown[]) => searchProducts(...a) }));

import { isSupportedQueryLanguage, looksLikePartNumber, sanitizeQuery, searchAll } from './search-all';

const base = { locale: 'en-US', currency: 'USD', country: 'US' };

const med = (slug: string, name: string): ProductProjection =>
  ({
    id: slug,
    key: `mlv-med-${slug}`,
    name: { 'en-US': name },
    slug: { 'en-US': slug },
    categories: [],
    masterVariant: { sku: `MED-${slug}`, prices: [{ value: { centAmount: 1450, currencyCode: 'USD', fractionDigits: 2 } }], attributes: [{ name: 'rxOnly', value: true }] },
  }) as unknown as ProductProjection;

const doc = (slug: string, name: string): ProductProjection =>
  ({ id: slug, key: `mlv-doc-${slug}`, name: { 'en-US': name }, slug: { 'en-US': slug }, categories: [], masterVariant: { attributes: [], prices: [] } }) as unknown as ProductProjection;

type Call = { extraQuery?: unknown; filters?: { modes?: string[] } };
/** Answers by what the call asks for: SKU lookups, doctors (modes filter) or medicines. */
function answer(o: { doctors?: ProductProjection[]; medicines?: ProductProjection[]; sku?: ProductProjection[] }) {
  searchProducts.mockImplementation(async (params: Call, map: (p: ProductProjection) => unknown) => {
    const json = JSON.stringify(params.extraQuery);
    const items = params.filters?.modes ? (o.doctors ?? []) : json.includes('variants.sku') ? (o.sku ?? []) : (o.medicines ?? []);
    return { items: items.map(map), total: items.length, offset: 0, limit: 8, facets: [] };
  });
}

beforeEach(() => {
  searchProducts.mockReset();
});

describe('search-results-page: Search results with exact part-number resolution', () => {
  it('Part number pasted: the product with that SKU is first, once, and says which part number matched', async () => {
    const amox = med('amoxicillin-500-mg', 'Amoxicillin 500 mg capsules');
    answer({ sku: [amox], medicines: [med('ibuprofen-400-mg', 'Ibuprofen 400 mg tablets'), amox] });
    const result = await searchAll({ ...base, q: 'med-amoxicillin-500-mg' });
    if (result.status !== 'ok') throw new Error('expected results');
    expect(result.exact?.sku).toBe('MED-amoxicillin-500-mg');
    expect(result.medicines.map((m) => m.slug)).toEqual(['amoxicillin-500-mg', 'ibuprofen-400-mg']);
    const skuCall = searchProducts.mock.calls.find(([p]) => JSON.stringify(p.extraQuery).includes('variants.sku'));
    expect(JSON.stringify(skuCall?.[0].extraQuery)).toContain('"caseInsensitive":true');
  });

  it('Part number pasted: a part-number-like query is looked up exactly, a plain word is not', async () => {
    answer({});
    await searchAll({ ...base, q: 'okafor' });
    expect(searchProducts).toHaveBeenCalledTimes(2);
    searchProducts.mockClear();
    await searchAll({ ...base, q: 'MED-x-1' });
    expect(searchProducts).toHaveBeenCalledTimes(3);
  });

  it('doctors and medicines are searched separately; only doctors carry the modes filter', async () => {
    answer({ doctors: [doc('okafor', 'Dr. Amara Okafor')] });
    const result = await searchAll({ ...base, q: 'okafor' });
    if (result.status !== 'ok') throw new Error('expected results');
    expect(result.doctors.map((d) => d.name)).toEqual(['Dr. Amara Okafor']);
    expect(result.medicines).toEqual([]);
    const [doctorCall, medicineCall] = searchProducts.mock.calls.map(([p]) => p);
    expect(doctorCall.filters.modes).toEqual(['remote', 'office']);
    expect(JSON.stringify(medicineCall.extraQuery)).toContain('variants.attributes.rxOnly');
  });

  it('Query matches nothing: an ok result with no hits (the page states it and offers browsing)', async () => {
    answer({});
    const result = await searchAll({ ...base, q: 'zzzz' });
    expect(result).toMatchObject({ status: 'ok', query: 'zzzz', doctors: [], medicines: [], exact: null, doctorTotal: 0, medicineTotal: 0 });
  });

  it('Misspelt query: names are matched fuzzily by the platform and no correction is claimed', async () => {
    answer({ medicines: [med('amoxicillin-500-mg', 'Amoxicillin 500 mg capsules')] });
    const result = await searchAll({ ...base, q: 'amoxicilin' });
    const json = JSON.stringify(searchProducts.mock.calls[1][0].extraQuery);
    expect(json).toContain('"fuzzy"');
    expect(json).toContain('"level":2');
    expect(Object.keys(result)).not.toContain('suggestion');
    expect(Object.keys(result)).not.toContain('correctedQuery');
  });

  it('a typed clinic name also matches doctors through the searchable clinicName attribute', async () => {
    answer({});
    await searchAll({ ...base, q: 'Austin Central' });
    expect(JSON.stringify(searchProducts.mock.calls[0][0].extraQuery)).toContain('variants.attributes.clinicName');
    expect(JSON.stringify(searchProducts.mock.calls[1][0].extraQuery)).not.toContain('clinicName');
  });

  it('Misspelt query: a specialty typed in part also matches the specialty', async () => {
    answer({});
    await searchAll({ ...base, q: 'dermat' });
    expect(JSON.stringify(searchProducts.mock.calls[0][0].extraQuery)).toContain('variants.attributes.specialty.key');
  });

  it('Unsupported language: reported as such, and no search is run', async () => {
    const result = await searchAll({ ...base, q: 'аспирин' });
    expect(result).toEqual({ status: 'unsupported-language', query: 'аспирин' });
    expect(searchProducts).not.toHaveBeenCalled();
    expect(isSupportedQueryLanguage('阿司匹林', 'en-US')).toBe(false);
    expect(isSupportedQueryLanguage('café 500', 'en-US')).toBe(true);
    expect(isSupportedQueryLanguage('500', 'en-US')).toBe(true);
  });

  it('an empty or blank query runs no search', async () => {
    expect(await searchAll({ ...base, q: undefined })).toEqual({ status: 'empty-query' });
    expect(await searchAll({ ...base, q: '  <>  ' })).toEqual({ status: 'empty-query' });
    expect(searchProducts).not.toHaveBeenCalled();
  });

  it('query sanitising: markup and control characters go, the length is capped', () => {
    expect(sanitizeQuery('  <b>amox</b>\n\t500 ')).toBe('b amox /b 500');
    expect(sanitizeQuery('MED-x_1;DROP')).toBe('MED-x 1 DROP');
    expect(sanitizeQuery('a'.repeat(300))).toHaveLength(80);
    expect(sanitizeQuery(undefined)).toBe('');
    expect(sanitizeQuery('O’Brien')).toBe('O Brien');
  });

  it('part-number detection', () => {
    expect(looksLikePartNumber('MED-ibuprofen-400-mg')).toBe(true);
    expect(looksLikePartNumber('RX123')).toBe(true);
    expect(looksLikePartNumber('okafor')).toBe(false);
    expect(looksLikePartNumber('two words 1')).toBe(false);
    expect(looksLikePartNumber('a1')).toBe(false);
  });

  it('the query text is never logged', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    answer({});
    await searchAll({ ...base, q: 'secretword' });
    searchProducts.mockRejectedValue(new Error('down'));
    await expect(searchAll({ ...base, q: 'secretword' })).rejects.toThrow('down');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((s) => s.mockRestore());
  });
});
