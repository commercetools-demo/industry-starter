// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const load = vi.hoisted(() => ({
  count: vi.fn(),
  listing: vi.fn(),
  category: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/listing/load', () => ({ loadCount: load.count, loadListing: load.listing }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryByKey: load.category }));

import { GET } from './route';

const call = (qs: string) => GET(new Request(`http://x/api/search?${qs}`), { params: Promise.resolve({}) });
beforeEach(() => {
  load.count.mockReset();
  load.listing.mockReset();
  load.category.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/search', () => {
  it('countOnly returns just the total and passes the filters through', async () => {
    load.count.mockResolvedValue({ total: 12 });
    const res = await call('countOnly=1&scope=shop&locale=en-CA&f_roast=dark&page=3');
    expect(await res.json()).toEqual({ total: 12 });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(load.count).toHaveBeenCalledWith({ locale: 'en-CA', scopeParam: 'shop', searchParams: expect.objectContaining({ f_roast: 'dark', page: '3' }) });
  });
  it('invalid params 400', async () => {
    expect((await call('countOnly=1&scope=%22drop')).status).toBe(400);
    expect((await call('countOnly=1&scope=shop&locale=fr-FR')).status).toBe(400);
    expect(load.count).not.toHaveBeenCalled();
  });
  it('unsupported language 422', async () => {
    load.count.mockResolvedValue({ status: 'unsupported_language' });
    expect((await call('countOnly=1&scope=shop&locale=en-US')).status).toBe(422);
  });
  it('unknown category scope 404', async () => {
    load.count.mockResolvedValue({ status: 'unknown_scope' });
    expect((await call('countOnly=1&scope=mcf-cat-nope&locale=en-US')).status).toBe(404);
    load.category.mockResolvedValue(null);
    expect((await call('scope=mcf-cat-nope&locale=en-US')).status).toBe(404);
  });
  it('full response has items, facets and paging', async () => {
    load.listing.mockResolvedValue({ kind: 'ok', total: 2, items: [{ id: 'a' }], groups: [{ name: 'roast' }], page: 1, pageCount: 1 });
    const body = await (await call('scope=shop&locale=en-US&q=ember')).json();
    expect(body).toEqual({ total: 2, items: [{ id: 'a' }], facets: [{ name: 'roast' }], page: 1, pageCount: 1 });
    expect(load.listing).toHaveBeenCalledWith(expect.objectContaining({ scope: 'search', locale: 'en-US' }));
  });
  it('a search failure becomes 503', async () => {
    load.count.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 503 }));
    expect((await call('countOnly=1&scope=shop&locale=en-US')).status).toBe(503);
  });
});
