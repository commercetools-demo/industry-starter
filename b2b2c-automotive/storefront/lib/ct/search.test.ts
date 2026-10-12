// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchContext } from '@/lib/search/build';
import { parseListingParams } from '@/lib/search/params';

const post = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: { products: () => ({ search: () => ({ post: (args: unknown) => ({ execute: () => post(args) }) }) }) }, projectKey: 'p' }));

import { countAssortment, searchParts } from './search';

const ctx: SearchContext = { storeId: 's1', locale: 'en-US', currency: 'USD', country: 'US', branchChannelId: 'b', retailChannelId: 'r', fitKeys: null };
const params = (sp: Record<string, string | string[]> = {}) => parseListingParams(sp);
const result = (ids: string[], total = ids.length, facets: unknown[] = []) => ({ body: { total, offset: 0, limit: 24, facets, results: ids.map((id) => ({ id })) } });
const bodyOf = (n: number) => post.mock.calls[n][0].body as { query: unknown; limit: number };

beforeEach(() => {
  post.mockReset();
});

describe('Search service: lib/ct/search', () => {
  it('returns ids in the order of the search, the total and the facets', async () => {
    post.mockResolvedValue(
      result(['c', 'a', 'b'], 40, [
        { name: 'brand', buckets: [{ key: 'vektra', count: 3 }] },
        { name: 'ignored-stats', min: 1, max: 2 },
      ]),
    );
    const out = await searchParts(ctx, {}, params());
    expect(out.ids).toEqual(['c', 'a', 'b']);
    expect(out.total).toBe(40);
    expect(out.facets).toEqual([{ name: 'brand', buckets: [{ key: 'vektra', count: 3 }] }]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('exact part number first and not repeated', async () => {
    post.mockImplementation(async ({ body }: { body: { limit: number } }) => (body.limit === 24 ? result(['x', 'part', 'y'], 3) : result(['part'])));
    const out = await searchParts(ctx, {}, params({ q: 'MLV-BP-41001' }));
    expect(out.ids).toEqual(['part', 'x', 'y']);
    expect(out.total).toBe(3);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('the exact request ignores the fit scope and the list is never longer than a page', async () => {
    const ids = Array.from({ length: 24 }, (_, i) => `m${i}`);
    post.mockImplementation(async ({ body }: { body: { limit: number } }) => (body.limit === 24 ? result(ids, 60) : result(['e1', 'e2'])));
    const out = await searchParts({ ...ctx, fitKeys: ['k'] }, {}, params({ q: 'BP-2210' }));
    expect(out.ids).toHaveLength(24);
    expect(out.ids.slice(0, 2)).toEqual(['e1', 'e2']);
    expect(JSON.stringify(bodyOf(1).query)).not.toContain('fitment-keys');
    expect(JSON.stringify(bodyOf(0).query)).toContain('fitment-keys');
  });

  it('a non fitting exact part is shown first and counted once', async () => {
    post.mockImplementation(async ({ body }: { body: { limit: number } }) => (body.limit === 24 ? result(['f1', 'f2'], 2) : result(['nofit'])));
    const out = await searchParts({ ...ctx, fitKeys: ['k'] }, {}, params({ q: 'MLV-BP-41005' }));
    expect(out.ids).toEqual(['nofit', 'f1', 'f2']);
    expect(out.total).toBe(3);
  });

  it('without fit scope an exact part that is already in the result adds nothing to the total', async () => {
    post.mockImplementation(async ({ body }: { body: { limit: number } }) => (body.limit === 24 ? result(['f1', 'f2'], 2) : result(['f2'])));
    const out = await searchParts(ctx, {}, params({ q: 'MLV-BP-41005' }));
    expect(out.ids).toEqual(['f2', 'f1']);
    expect(out.total).toBe(2);
  });

  it('words and later pages do not run the exact request', async () => {
    post.mockResolvedValue(result(['a']));
    await searchParts(ctx, {}, params({ q: 'brake pads' }));
    await searchParts(ctx, {}, params({ q: 'MLV-BP-41001', page: '2' }));
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('counts the assortment of a scope without the fit scope', async () => {
    post.mockResolvedValue(result([], 12));
    expect(await countAssortment(ctx, { categoryId: 'c1' })).toBe(12);
    expect(bodyOf(0)).toMatchObject({ limit: 0 });
    expect(JSON.stringify(bodyOf(0).query)).toContain('categoriesSubTree');
  });

  it('sends the request to Product Search, never to product projection search', async () => {
    post.mockResolvedValue(result([]));
    await searchParts(ctx, {}, params());
    expect(JSON.stringify(post.mock.calls[0][0])).not.toContain('productProjectionParameters');
  });
});
