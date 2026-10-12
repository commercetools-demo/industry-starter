import { describe, expect, it, vi } from 'vitest';
import { importHost, liveTransport, productDraftResource, runImport, standalonePriceResource, type ImportOperationState, type ImportResourceType, type ImportTransport } from './import-api';
import type { ImportItem } from './validate';

const item = (n: number): ImportItem => ({
  row: n + 1,
  key: `local-store-a-tst-w-${n}`,
  sku: `TST-W-${n}`,
  name: { 'de-DE': `Teil ${n}`, 'en-US': `Part ${n}` },
  description: {},
  slug: { 'de-DE': `teil-${n}`, 'en-US': `part-${n}` },
  categoryKeys: ['mau-cat-brakes'],
  priceCents: 1000 + n,
});

interface Call {
  op: 'container' | 'import';
  container: string;
  type: ImportResourceType;
  count?: number;
}

/** In-memory Import API: operations are `processing` on the first poll, then `imported` (or rejected for a chosen key). */
function fakeTransport(rejectKeys: string[] = []) {
  const calls: Call[] = [];
  const resources = new Map<string, { key: string; type: ImportResourceType; polls: number }[]>();
  const transport: ImportTransport = {
    async createContainer(key, type) {
      calls.push({ op: 'container', container: key, type });
      resources.set(key, []);
    },
    async importResources(container, type, items) {
      calls.push({ op: 'import', container, type, count: items.length });
      for (const r of items as { key: string }[]) resources.get(container)?.push({ key: r.key, type, polls: 0 });
    },
    async operations(container) {
      return (resources.get(container) ?? []).map((r): ImportOperationState => {
        r.polls += 1;
        if (r.polls < 2) return { resourceKey: r.key, state: 'processing', errors: [] };
        return rejectKeys.includes(r.key) ? { resourceKey: r.key, state: 'validationFailed', errors: ['slug already in use'] } : { resourceKey: r.key, state: 'imported', errors: [] };
      });
    },
  };
  return { transport, calls };
}

describe('import commits in chunks of 20', () => {
  it('112 rows give 6 product requests of at most 20 and 6 standalone price requests, prices only after the products are imported', async () => {
    const { transport, calls } = fakeTransport();
    const items = Array.from({ length: 112 }, (_, i) => item(i + 1));
    const sleep = vi.fn(async () => undefined);
    const result = await runImport(items, { storeKey: 'store-a', channelKey: 'mau-dist-a', transport, stamp: '20261012120000', sleep });
    const imports = calls.filter((c) => c.op === 'import');
    const products = imports.filter((c) => c.type === 'product-draft');
    const prices = imports.filter((c) => c.type === 'standalone-price');
    expect(products).toHaveLength(6);
    expect(products.every((c) => (c.count ?? 0) <= 20)).toBe(true);
    expect(products.reduce((n, c) => n + (c.count ?? 0), 0)).toBe(112);
    expect(prices).toHaveLength(6);
    expect(calls.findIndex((c) => c.type === 'standalone-price')).toBeGreaterThan(calls.findLastIndex((c) => c.type === 'product-draft'));
    expect(calls.filter((c) => c.op === 'container').map((c) => c.container)).toEqual(['import-store-a-20261012120000', 'import-store-a-20261012120000-prices']);
    expect(sleep).toHaveBeenCalled(); // it polled until the operations left "processing"
    expect(result.imported).toHaveLength(112);
    expect(result.failed).toEqual([]);
  });

  it('reports failed rows and gives them no price', async () => {
    const { transport, calls } = fakeTransport(['local-store-a-tst-w-2']);
    const result = await runImport([item(1), item(2), item(3)], { storeKey: 'store-a', channelKey: 'mau-dist-a', transport, stamp: 's', sleep: async () => undefined });
    expect(result.failed).toEqual([{ sku: 'TST-W-2', error: 'slug already in use' }]);
    expect(result.imported).toEqual(['TST-W-1', 'TST-W-3']);
    expect(calls.find((c) => c.type === 'standalone-price' && c.op === 'import')?.count).toBe(2);
  });

  it('gives up after the maximum wait and reports the rows as not finished', async () => {
    const transport: ImportTransport = { createContainer: async () => undefined, importResources: async () => undefined, operations: async () => [{ resourceKey: 'local-store-a-tst-w-1', state: 'processing', errors: [] }] };
    const result = await runImport([item(1)], { storeKey: 'store-a', channelKey: 'c', transport, stamp: 's', sleep: async () => undefined, maxWaitMs: 0 });
    expect(result.failed).toEqual([{ sku: 'TST-W-1', error: 'not finished' }]);
  });
});

describe('import resources', () => {
  it('a product draft is a local part with a variant key, standalone price mode, owner and approved review state, no embedded prices', () => {
    const draft = productDraftResource(item(1), 'store-a');
    expect(draft).toMatchObject({ productType: { typeId: 'product-type', key: 'mau-pt-local-part' }, priceMode: 'Standalone', publish: true, masterVariant: { key: 'TST-W-1', sku: 'TST-W-1' } });
    expect(JSON.stringify(draft)).not.toContain('"prices"');
    expect(draft.masterVariant.attributes).toEqual([
      { name: 'part-number', value: 'TST-W-1' },
      { name: 'owner-store', value: 'store-a' },
      { name: 'review-state', value: 'approved' },
    ]);
    expect(JSON.stringify(draft)).not.toMatch(/fitment/);
  });
  it('a price import is a cent precision standalone price on the distribution channel with the key scheme of the price writer', () => {
    expect(standalonePriceResource(item(1), 'mau-dist-a')).toEqual({ key: 'TST-W-1__mau-dist-a', sku: 'TST-W-1', value: { type: 'centPrecision', currencyCode: 'EUR', centAmount: 1001, fractionDigits: 2 }, country: 'DE', channel: { typeId: 'channel', key: 'mau-dist-a' } });
  });
  it('the import host replaces the api. prefix', () => {
    expect(importHost('https://api.europe-west1.gcp.commercetools.com')).toBe('https://import.europe-west1.gcp.commercetools.com');
    expect(() => importHost('https://example.test')).toThrow();
  });
  it('the live transport posts the container and the request with a bearer token to the import host', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fetcher = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/oauth/token')) return Response.json({ access_token: 'tkn', expires_in: 3600 });
      return Response.json({ results: [], total: 0 });
    });
    const t = liveTransport({ projectKey: 'p1', apiUrl: 'https://api.eu.test.example', authUrl: 'https://auth.eu.test.example', clientId: 'id', clientSecret: 'secret', scopes: 'manage_import_containers:p1' }, fetcher as unknown as typeof fetch);
    await t.createContainer('c1', 'product-draft');
    await t.importResources('c1', 'product-draft', [{ key: 'a' }]);
    await t.operations('c1');
    const urls = fetcher.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain('https://import.eu.test.example/p1/import-containers');
    expect(urls).toContain('https://import.eu.test.example/p1/product-drafts/import-containers/c1');
    expect(urls.some((u) => u.startsWith('https://import.eu.test.example/p1/import-containers/c1/import-operations?limit=100'))).toBe(true);
    const init = fetcher.mock.calls.find((c) => String(c[0]).endsWith('/import-containers'))?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tkn');
  });
});
