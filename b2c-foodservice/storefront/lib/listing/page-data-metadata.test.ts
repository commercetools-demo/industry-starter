// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, string>) => `${key}${values?.name ? `:${values.name}` : ''}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/lib/listing/load', () => ({ loadListing: vi.fn() }));

import { listingMetadata } from '@/lib/listing/page-data';
import type { ListingResult } from '@/lib/listing/load';

const ok = (scope: 'category' | 'search' | 'all', extra: Record<string, unknown> = {}) =>
  ({ kind: 'ok', scope, params: { facets: {}, sort: 'featured', page: 1 }, basePath: '/shop', page: 1, pageCount: 1, category: { name: 'Pods', ...extra } }) as unknown as ListingResult;

describe('listing metadata', () => {
  it('a category page has a meta description, its own text first', async () => {
    expect((await listingMetadata('en-US', ok('category'))).description).toBe('description.category:Pods');
    expect((await listingMetadata('en-US', ok('category', { description: 'Own text' }))).description).toBe('Own text');
  });
  it('search and all-products pages have a meta description too', async () => {
    expect((await listingMetadata('en-US', ok('all'))).description).toBe('description.all');
    expect((await listingMetadata('en-US', ok('search'))).description).toBe('description.search');
  });
  it('a category or all-products page names itself as the canonical address, without filters or sort; a later page keeps its number; search has none', async () => {
    const page = (scope: 'category' | 'all', n: number, facets: Record<string, string[]> = {}) =>
      ({ kind: 'ok', scope, params: { facets, sort: 'price-asc', page: n }, basePath: '/category/pods', page: n, pageCount: 4, category: { name: 'Pods' } }) as unknown as ListingResult;
    expect((await listingMetadata('en-US', page('category', 1))).alternates?.canonical).toBe('/en-US/category/pods');
    expect((await listingMetadata('en-US', page('category', 3, { roast: ['dark'] }))).alternates?.canonical).toBe('/en-US/category/pods?page=3');
    expect((await listingMetadata('en-CA', page('all', 1))).alternates?.canonical).toBe('/en-CA/category/pods');
    expect((await listingMetadata('en-US', ok('search'))).alternates).toBeUndefined();
    // a canonical is resolved against the site origin, so the page carries an absolute address (a relative one is invalid)
    expect((await listingMetadata('en-US', page('category', 1))).metadataBase).toBeInstanceOf(URL);
  });
});
