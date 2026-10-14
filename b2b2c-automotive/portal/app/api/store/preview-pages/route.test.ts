// @vitest-environment node
// GET /api/store/preview-pages (workstream U-06): admin only, always the session's store (there is no store parameter to tamper
// with), a short HEAD probe per page, and a failed probe means "not available yet", never an error.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionFor } from '@/lib/authz/test-helpers';
import { makeRequest } from '@/test/request';
import { forbiddenRoot } from '@/test/seller';
import type { LogicalRole, Session } from '@/lib/types';

let session: Session = {};
let roles: LogicalRole[] = ['admin'];
let slug: string | null = 'brake-disc';
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session, devFixturesEnabled: () => false }));
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles: async () => ({ roleKeys: [], roles, ctPermissions: [] }) }));
vi.mock('@/lib/ct/admin-client', () => ({ adminRoot: forbiddenRoot() }));
vi.mock('@/lib/ct/preview-product', () => ({ findPreviewProductSlug: async () => slug }));
vi.mock('@/lib/portal/storefront-origin', () => ({ storefrontOrigin: () => 'https://shop.example.test' }));

import { GET } from './route';

const fetchMock = vi.fn();
beforeEach(() => {
  session = sessionFor('adminA');
  roles = ['admin'];
  slug = 'brake-disc';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => new Response(null, { status: url.endsWith('/cart') ? 404 : 200 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const get = (query = '') => GET(makeRequest(`/api/store/preview-pages${query}`));

describe('preview pages', () => {
  it('an anonymous caller is 401 and nothing is probed', async () => {
    session = {};
    expect((await get()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a Buyer is 403 and nothing is probed', async () => {
    session = sessionFor('buyerA');
    roles = ['buyer'];
    expect((await get()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('probes the five pages of the session store with HEAD and marks a 404 as not available', async () => {
    const response = await get('?locale=en-US');
    expect(response.status).toBe(200);
    const { pages } = (await response.json()) as { pages: { id: string; url: string | null; available: boolean }[] };
    expect(pages.map((p) => p.id)).toEqual(['home', 'listing', 'product', 'cart', 'checkout']);
    const store = session.storeKey as string;
    expect(pages[0].url).toBe(`https://shop.example.test/en-US/${store}`);
    expect(pages[2].url).toBe(`https://shop.example.test/en-US/${store}/p/brake-disc`);
    expect(pages.find((p) => p.id === 'cart')?.available).toBe(false);
    expect(pages.find((p) => p.id === 'home')?.available).toBe(true);
    for (const [, init] of fetchMock.mock.calls) expect(init).toMatchObject({ method: 'HEAD', redirect: 'manual' });
  });

  it('a store key in the query is ignored: only the session store is probed', async () => {
    await get('?storeKey=store-b&locale=de-DE');
    for (const [url] of fetchMock.mock.calls) expect(url).not.toContain('store-b');
  });

  it('no part in the assortment: the Product page has no URL and is not probed', async () => {
    slug = null;
    const { pages } = (await (await get()).json()) as { pages: { id: string; url: string | null; available: boolean }[] };
    expect(pages.find((p) => p.id === 'product')).toMatchObject({ url: null, available: false });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('an unreachable storefront gives available false for every page, not an error', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    const response = await get();
    expect(response.status).toBe(200);
    const { pages } = (await response.json()) as { pages: { available: boolean }[] };
    expect(pages.every((p) => !p.available)).toBe(true);
  });
});
