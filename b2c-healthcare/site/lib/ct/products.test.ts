// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// React's `cache` only memoizes inside a Server Components request; the stand-in memoizes by
// primitive arguments like the real one does, so the wiring (the export IS cache(fn)) is tested.
const { wrapped } = vi.hoisted(() => ({ wrapped: [] as unknown[] }));
vi.mock('react', () => ({
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
    wrapped.push(fn);
    const memo = new Map<string, R>();
    return (...args: A): R => {
      const k = JSON.stringify(args);
      if (!memo.has(k)) memo.set(k, fn(...args));
      return memo.get(k) as R;
    };
  },
}));

const execute = vi.fn();
const get = vi.fn(() => ({ execute }));
const withKey = vi.fn(() => ({ get }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { productProjections: () => ({ withKey }) } }));

import { getProductByKey, getProductByKeyCached } from './products';

const projection = {
  id: 'p1',
  key: 'mlv-doc-okafor',
  productType: { typeId: 'product-type', id: 'pt1' },
  name: { 'en-US': 'Dr. Okafor' },
  slug: { 'en-US': 'okafor' },
  description: { 'en-US': 'Bio' },
  masterVariant: { id: 1, sku: 'DOC-okafor', images: [{ url: 'https://img/x.jpg', dimensions: { w: 1, h: 1 } }] },
  categories: [{ typeId: 'category', id: 'c1' }],
};

describe('storefront-data-loading: Request de-duplication', () => {
  beforeEach(() => {
    execute.mockReset();
    get.mockClear();
    withKey.mockClear();
  });

  it('Request de-duplication: generateMetadata and the page share one client call', async () => {
    execute.mockResolvedValue({ body: projection });
    const [meta, page] = [await getProductByKeyCached('mlv-doc-okafor', 'USD', 'US'), await getProductByKeyCached('mlv-doc-okafor', 'USD', 'US')];
    expect(meta).toBe(page);
    expect(withKey).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('the cached export wraps getProductByKey with React cache()', () => {
    expect(wrapped).toContain(getProductByKey);
  });

  it('maps the projection to app types and a missing product to null', async () => {
    execute.mockResolvedValueOnce({ body: projection });
    expect(await getProductByKey('k', 'USD', 'US')).toEqual({
      id: 'p1',
      key: 'mlv-doc-okafor',
      productTypeId: 'pt1',
      name: { 'en-US': 'Dr. Okafor' },
      slug: { 'en-US': 'okafor' },
      description: { 'en-US': 'Bio' },
      sku: 'DOC-okafor',
      imageUrls: ['https://img/x.jpg'],
      categoryIds: ['c1'],
    });
    execute.mockRejectedValueOnce({ statusCode: 404 });
    expect(await getProductByKey('missing', 'USD', 'US')).toBeNull();
    execute.mockRejectedValueOnce({ statusCode: 500 });
    await expect(getProductByKey('x', 'USD', 'US')).rejects.toMatchObject({ statusCode: 500 });
  });
});
