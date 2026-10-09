import { describe, expect, it } from 'vitest';
import { planProjectActions } from './configure-project';
import { deletionOrder, isSeedOwned, validateManifest, type Manifest } from './sample-manifest';
import { checkServiceProduct, type ProductView } from './verify';

describe('sample manifest (no wildcard deletion, D15)', () => {
  const base: Manifest = { projectKey: 'malva-demo', createdAt: '2026-10-08T00:00:00Z', entries: [] };

  it('accepts sample resources of the right project', () => {
    expect(validateManifest({ ...base, entries: [{ kind: 'products', id: '1', version: 1, key: 'sample-product' }] }, 'malva-demo')).toEqual([]);
  });

  it('rejects a manifest for another project', () => {
    expect(validateManifest({ ...base, projectKey: 'other' }, 'malva-demo')[0]).toMatch(/not "malva-demo"/);
  });

  it('rejects any entry owned by the seed, by key or by custom-object container', () => {
    const errors = validateManifest({ ...base, entries: [{ kind: 'categories', id: '1', version: 1, key: 'mpw-plumbing' }, { kind: 'custom-objects', id: '2', version: 1, key: 'a', container: 'mpw-visits' }] }, 'malva-demo');
    expect(errors).toHaveLength(2);
    expect(isSeedOwned({ key: 'mpw-x' })).toBe(true);
    expect(isSeedOwned({ key: 'sample' })).toBe(false);
  });

  it('rejects unknown kinds', () => {
    expect(validateManifest({ ...base, entries: [{ kind: 'everything' as never, id: '1', version: 1 }] }, 'malva-demo')[0]).toMatch(/unknown kind/);
  });

  it('orders dependants before what they reference and deepest categories first', () => {
    const order = deletionOrder([
      { kind: 'product-types', id: 'pt', version: 1 },
      { kind: 'categories', id: 'root', version: 1, depth: 0 },
      { kind: 'products', id: 'p', version: 1 },
      { kind: 'categories', id: 'leaf', version: 1, depth: 2 },
      { kind: 'orders', id: 'o', version: 1 },
    ]).map((e) => e.id);
    expect(order).toEqual(['o', 'p', 'leaf', 'root', 'pt']);
  });
});

describe('planProjectActions (owner request: search + tax fallback)', () => {
  const settled = { languages: ['en-US', 'de-DE'], countries: ['US', 'DE'], currencies: ['USD', 'EUR'], searchIndexing: { productsSearch: { status: 'Activated' } }, carts: { countryTaxRateFallbackEnabled: true } } as never;

  it('asks for nothing when everything is already as required', () => {
    expect(planProjectActions(settled)).toEqual([]);
  });

  it('enables Product Search indexing and the tax fallback when they are off', () => {
    const actions = planProjectActions({ languages: ['en-US', 'de-DE'], countries: ['US', 'DE'], currencies: ['USD', 'EUR'], searchIndexing: { productsSearch: { status: 'Deactivated' } }, carts: { countryTaxRateFallbackEnabled: false } } as never);
    expect(actions).toEqual([
      { action: 'changeProductSearchIndexingEnabled', enabled: true, mode: 'ProductsSearch' },
      { action: 'changeCountryTaxRateFallbackEnabled', countryTaxRateFallbackEnabled: true },
    ]);
  });

  it('adds US/DE, USD/EUR and en-US/de-DE without removing what the project already has', () => {
    const actions = planProjectActions({ ...(settled as object), languages: ['en-GB'], countries: ['GB'], currencies: ['GBP'] } as never);
    expect(actions).toEqual([
      { action: 'changeLanguages', languages: ['en-GB', 'en-US', 'de-DE'] },
      { action: 'changeCountries', countries: ['GB', 'US', 'DE'] },
      { action: 'changeCurrencies', currencies: ['GBP', 'USD', 'EUR'] },
    ]);
  });
});

describe('checkServiceProduct (verify.ts assertions)', () => {
  const good: ProductView = {
    key: 'mpw-svc-recycling',
    masterData: { published: true, current: { masterVariant: { sku: 'MPW-RECYCLING', prices: [{ value: { currencyCode: 'USD', centAmount: 0 } }, { value: { currencyCode: 'EUR', centAmount: 0 } }], images: [{ url: 'https://h/a.jpg' }] }, categories: [{ id: 'c' }] } },
  };

  it('passes a correct product', () => {
    expect(checkServiceProduct(good)).toEqual([]);
  });

  it('flags a missing price, a non-zero price, an unpublished product, no image and a dirty image URL', () => {
    const bad: ProductView = { key: 'mpw-svc-x', masterData: { published: false, current: { masterVariant: { prices: [{ value: { currencyCode: 'USD', centAmount: 500 } }], images: [{ url: 'https://h/a.jpg?w=1' }] }, categories: [] } } };
    const problems = checkServiceProduct(bad).join('\n');
    expect(problems).toMatch(/not published/);
    expect(problems).toMatch(/price must be 0/);
    expect(problems).toMatch(/not clean/);
    expect(problems).toMatch(/exactly one category/);
    expect(checkServiceProduct({ ...good, masterData: { ...good.masterData, current: { ...good.masterData.current, masterVariant: { prices: [], images: [] } } } }).join('\n')).toMatch(/no USD price[\s\S]*no images/);
  });

  it('flags a key without the mpw-svc- prefix', () => {
    expect(checkServiceProduct({ ...good, key: 'sample' }).join('')).toMatch(/must start with mpw-svc-/);
  });
});
