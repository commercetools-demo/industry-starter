// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cacheOptions } = vi.hoisted(() => ({ cacheOptions: [] as unknown[] }));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, _keys: unknown, options: unknown) => {
    cacheOptions.push(options);
    return fn;
  },
}));
const categoriesGet = vi.fn();
const shippingGet = vi.fn();
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    categories: () => ({ get: (a: unknown) => ({ execute: () => categoriesGet(a) }) }),
    shippingMethods: () => ({ get: (a: unknown) => ({ execute: () => shippingGet(a) }) }),
  },
}));

import { CATEGORY_TREE_REVALIDATE_SECONDS, getCategoryTree } from './categories';
import { getShippingMethods, SHIPPING_METHODS_REVALIDATE_SECONDS } from './shipping';

const cat = (id: string, key: string, orderHint: string, parent?: string) => ({
  id,
  key,
  name: { 'en-US': key },
  slug: { 'en-US': key },
  orderHint,
  ...(parent ? { parent: { typeId: 'category', id: parent } } : {}),
});

describe('storefront-data-loading: public reads', () => {
  beforeEach(() => {
    categoriesGet.mockReset();
    shippingGet.mockReset();
  });

  it('category tree is nested, ordered by orderHint, and cached 60 s', async () => {
    expect(CATEGORY_TREE_REVALIDATE_SECONDS).toBe(60);
    expect(cacheOptions).toContainEqual({ revalidate: 60 });
    categoriesGet.mockResolvedValue({
      body: {
        results: [
          cat('2', 'mlv-cardiology', '0.2', '1'),
          cat('1', 'mlv-doctors', '0.1'),
          cat('3', 'mlv-dermatology', '0.1', '1'),
          cat('4', 'mlv-medicines', '0.2'),
        ],
      },
    });
    const tree = await getCategoryTree();
    expect(tree.map((c) => c.key)).toEqual(['mlv-doctors', 'mlv-medicines']);
    expect(tree[0].children.map((c) => c.key)).toEqual(['mlv-dermatology', 'mlv-cardiology']);
    expect(tree[0].children[0].parentId).toBe('1');
  });

  it('shipping methods: active only, rates mapped to cents, cached 60 s', async () => {
    expect(SHIPPING_METHODS_REVALIDATE_SECONDS).toBe(60);
    shippingGet.mockResolvedValue({
      body: {
        results: [
          {
            id: 's1',
            key: 'mlv-same-day',
            name: 'Same-day',
            localizedDescription: { 'en-US': 'By 8 pm' },
            isDefault: false,
            zoneRates: [
              {
                zone: { typeId: 'zone', id: 'z1' },
                shippingRates: [{ price: { centAmount: 500, currencyCode: 'USD' } }],
              },
            ],
          },
        ],
      },
    });
    const methods = await getShippingMethods();
    expect(shippingGet.mock.calls[0][0]).toMatchObject({ queryArgs: { where: 'active=true' } });
    expect(methods[0]).toMatchObject({ key: 'mlv-same-day', description: { 'en-US': 'By 8 pm' } });
    expect(methods[0].rates[0]).toEqual({
      zoneId: 'z1',
      price: { centAmount: 500, currencyCode: 'USD', fractionDigits: 2 },
      freeAbove: null,
    });
  });
});

describe('storefront-data-loading: Caching only for public, stable data', () => {
  const dir = join(import.meta.dirname);
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('Per-patient data never shared: no lib/ct file wrapping unstable_cache mentions customerId, cartId or session', () => {
    const cached = files.filter((f) => readFileSync(join(dir, f), 'utf8').includes('unstable_cache('));
    expect(cached.length).toBeGreaterThanOrEqual(3);
    for (const f of cached) {
      const code = stripComments(readFileSync(join(dir, f), 'utf8'));
      expect(code, `${f} must not cache session-dependent data`).not.toMatch(/customerId|cartId|session/i);
    }
  });

  it('the scan itself flags a violating source', () => {
    const bad = 'export const f = unstable_cache(async (customerId: string) => customerId, [])';
    expect(/customerId|cartId|session/i.test(stripComments(bad))).toBe(true);
  });
});
