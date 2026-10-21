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
});
