// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Role matrix and happy paths of every seller store endpoint (workstream U-05): Admin 200, Buyer 403, bad input 400, with the
// commercetools modules mocked. The cross-store refusals are in each route's route.cross-store.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionFor } from '@/lib/authz/test-helpers';
import { UnprocessableError } from '@/lib/store/errors';
import type { LogicalRole, Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

let session: Session = sessionFor('adminA');
let roles: LogicalRole[] = ['admin'];
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session, devFixturesEnabled: () => false }));
vi.mock('@/lib/ct/associate', () => ({ getAssociateRoles: async () => ({ roleKeys: [], roles, ctPermissions: [] }) }));
vi.mock('@/lib/ct/admin-client', () => ({ adminRoot: {} }));

const settings = { key: 'store-a', name: { 'de-DE': 'A', 'en-US': 'A' }, location: {}, address: 'http://localhost:3000/de-DE/store-a' };
const getStoreSettings = vi.fn(async (_k: string) => settings);
const saveStoreSettings = vi.fn(async () => settings);
const setStoreAsset = vi.fn(async (_s: string, _k: string, url: string | null) => ({ ...settings, logoUrl: url ?? undefined }));
vi.mock('@/lib/ct/seller/store-settings', () => ({ getStoreSettings: (k: string) => getStoreSettings(k), saveStoreSettings: (...a: unknown[]) => saveStoreSettings(...(a as [])), setStoreAsset: (...a: [string, string, string | null]) => setStoreAsset(...a) }));

const branch = { key: 'mau-br-x', name: { 'de-DE': 'X', 'en-US': 'X' } };
const listBranches = vi.fn(async (_k: string) => [branch]);
const createBranch = vi.fn(async () => branch);
const updateBranch = vi.fn(async () => branch);
const removeBranch = vi.fn(async () => undefined);
vi.mock('@/lib/ct/seller/branches', () => ({ listBranches: (k: string) => listBranches(k), createBranch: (...a: unknown[]) => createBranch(...(a as [])), updateBranch: (...a: unknown[]) => updateBranch(...(a as [])), removeBranch: (...a: unknown[]) => removeBranch(...(a as [])) }));

const listBranchStock = vi.fn(async () => ({ rows: [], total: 0, offset: 0, limit: 50, currency: 'EUR' }));
const setBranchStock = vi.fn(async (..._a: unknown[]) => ({ sku: 'S', name: {}, availableQuantity: 1, priceCent: null }));
vi.mock('@/lib/ct/seller/branch-stock', () => ({ listBranchStock: (...a: unknown[]) => listBranchStock(...(a as [])), setBranchStock: (...a: unknown[]) => setBranchStock(...a) }));

const loadChannelStats = vi.fn(async () => ({ rows: [], truncated: false, currency: 'EUR', days: 30 }));
vi.mock('@/lib/ct/seller/channel-stats', () => ({ loadChannelStats: (...a: unknown[]) => loadChannelStats(...(a as [])) }));

const upload = vi.fn(async (_k: string, _f: unknown) => 'https://files.example.test/store-a/logo.png');
const deleteStoreTheme = vi.fn(async (_k: string) => undefined);
const hasPublishedPage = vi.fn(async (_k: string, _s: string) => true);
vi.mock('@/lib/contentools/service', () => ({ uploadStoreFile: (k: string, f: unknown) => upload(k, f), deleteStoreTheme: (k: string) => deleteStoreTheme(k), hasPublishedPage: (k: string, s: string) => hasPublishedPage(k, s) }));
const geocodeAddress = vi.fn(async (_a: string) => ({ result: { label: 'x', lat: 1, lng: 2 }, unavailable: false }));
vi.mock('@/lib/geo/nominatim', () => ({ geocodeAddress: (a: string) => geocodeAddress(a) }));

import * as branchesRoute from './branches/route';
import * as branchRoute from './branches/[key]/route';
import * as stockListRoute from './branches/[key]/stock/route';
import * as stockPutRoute from './branches/[key]/stock/[sku]/route';
import * as channelsRoute from './channels/route';
import * as faviconRoute from './favicon/route';
import * as geocodeRoute from './geocode/route';
import * as linkRoute from './link-in-bio-status/route';
import * as logoRoute from './logo/route';
import * as settingsRoute from './settings/route';
import * as themeRoute from './theme/route';

const S = 'store-a';
const key = { params: Promise.resolve({ key: 'mau-br-x' }) };
const skuCtx = { params: Promise.resolve({ key: 'mau-br-x', sku: 'MLV-BP-41001' }) };

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 0);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}
const file = (bytes: Uint8Array, name = 'a.png') => {
  const form = new FormData();
  form.set('storeKey', S);
  form.set('file', new Blob([bytes as BlobPart], { type: 'image/png' }), name);
  return form;
};
const post = (url: string, body: FormData) => new Request(`http://localhost:3000${url}`, { method: 'POST', body });

const NAME = { 'de-DE': 'Test Shop', 'en-US': 'Test Shop' };
const BRANCH = { storeKey: S, name: NAME, address: { streetName: 'Hafenallee', postalCode: '21079', city: 'Hamburg', country: 'DE' }, openingHours: { mon: ['08:00', '18:00'] }, timezone: 'Europe/Berlin', pickupMode: 'same-day' };

beforeEach(() => {
  session = sessionFor('adminA');
  roles = ['admin'];
  for (const m of [getStoreSettings, saveStoreSettings, setStoreAsset, listBranches, createBranch, updateBranch, removeBranch, listBranchStock, setBranchStock, loadChannelStats, upload, deleteStoreTheme, hasPublishedPage, geocodeAddress]) m.mockClear();
});

const asBuyer = () => {
  session = sessionFor('buyerA');
  roles = ['buyer'];
};

describe('settings', () => {
  it('Admin reads and saves; the save passes only name and location', async () => {
    expect((await settingsRoute.GET(makeRequest(`/api/seller/store/settings?storeKey=${S}`))).status).toBe(200);
    const res = await settingsRoute.PUT(makeRequest('/api/seller/store/settings', { method: 'PUT', json: { storeKey: S, name: NAME, location: { city: 'Hamburg', latitude: 1, longitude: 2 } } }));
    expect(res.status).toBe(200);
    expect(saveStoreSettings).toHaveBeenCalledWith(S, { name: NAME, location: { city: 'Hamburg', latitude: 1, longitude: 2 } });
  });
  it('latitude without longitude is 400 and nothing is saved', async () => {
    const res = await settingsRoute.PUT(makeRequest('/api/seller/store/settings', { method: 'PUT', json: { storeKey: S, name: NAME, location: { latitude: 1 } } }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('Enter both latitude and longitude, or neither');
    expect(saveStoreSettings).not.toHaveBeenCalled();
  });
  it('Buyer is 403 for both', async () => {
    asBuyer();
    expect((await settingsRoute.GET(makeRequest(`/api/seller/store/settings?storeKey=${S}`))).status).toBe(403);
    expect((await settingsRoute.PUT(makeRequest('/api/seller/store/settings', { method: 'PUT', json: { storeKey: S, name: NAME, location: {} } }))).status).toBe(403);
    expect(saveStoreSettings).not.toHaveBeenCalled();
  });
  it('a field outside the contract (the storefront address) is 400', async () => {
    const res = await settingsRoute.PUT(makeRequest('/api/seller/store/settings', { method: 'PUT', json: { storeKey: S, name: NAME, location: {}, address: 'https://evil.test' } }));
    expect(res.status).toBe(400);
  });
});

describe('logo and favicon', () => {
  it('Admin uploads a PNG logo 800 x 400: stored through the image store, clean URL saved on logoUrl', async () => {
    const res = await logoRoute.POST(post('/api/seller/store/logo', file(png(800, 400))));
    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
    const [storeKey, sent] = upload.mock.calls[0] as [string, { type: string; name: string }];
    expect(storeKey).toBe(S);
    expect(sent.type).toBe('image/png');
    expect(sent.name).toMatch(/^logo-\d+\.png$/);
    expect(setStoreAsset).toHaveBeenCalledWith(S, 'logoUrl', 'https://files.example.test/store-a/logo.png');
  });
  it('a favicon is saved on faviconUrl', async () => {
    expect((await faviconRoute.POST(post('/api/seller/store/favicon', file(png(256, 256))))).status).toBe(200);
    expect(setStoreAsset).toHaveBeenCalledWith(S, 'faviconUrl', expect.any(String));
  });
  it('a GIF and a 50 x 50 image are refused with the limit text, nothing is uploaded', async () => {
    const gif = new Uint8Array(40).map((_, i) => 'GIF89a'.charCodeAt(i) || 0);
    const bad = await logoRoute.POST(post('/api/seller/store/logo', file(gif, 'a.gif')));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe('Use a JPG, PNG or WebP at least 600 px wide and at most 5 MB.');
    const small = await faviconRoute.POST(post('/api/seller/store/favicon', file(png(50, 50))));
    expect(small.status).toBe(400);
    expect(((await small.json()) as { error: string }).error).toContain('128 x 128');
    expect(upload).not.toHaveBeenCalled();
    expect(setStoreAsset).not.toHaveBeenCalled();
  });
  it('the client file name and type are not trusted: a text file called logo.png is refused', async () => {
    const text = new TextEncoder().encode('<svg><script>alert(1)</script></svg> padding padding padding');
    expect((await logoRoute.POST(post('/api/seller/store/logo', file(text)))).status).toBe(400);
  });
  it('an oversized request is 413 before the file is read; a non-multipart body is 400', async () => {
    const big = new Request('http://localhost:3000/api/seller/store/logo', { method: 'POST', body: file(png(800, 400)), headers: { 'content-length': String(6 * 1024 * 1024) } });
    expect((await logoRoute.POST(big)).status).toBe(413);
    expect((await logoRoute.POST(makeRequest('/api/seller/store/logo', { method: 'POST', json: { storeKey: S } }))).status).toBe(400);
  });
  it('Buyer is 403 and the file is never read', async () => {
    asBuyer();
    expect((await logoRoute.POST(post('/api/seller/store/logo', file(png(800, 400))))).status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('branches', () => {
  it('Admin lists, creates (201), edits and removes', async () => {
    expect((await branchesRoute.GET(makeRequest(`/api/seller/store/branches?storeKey=${S}`))).status).toBe(200);
    expect((await branchesRoute.POST(makeRequest('/api/seller/store/branches', { method: 'POST', json: { ...BRANCH, slug: 'test-branch' } }))).status).toBe(201);
    expect(createBranch).toHaveBeenCalledWith(S, expect.objectContaining({ slug: 'test-branch' }));
    expect((await branchRoute.PUT(makeRequest('/api/seller/store/branches/mau-br-x', { method: 'PUT', json: BRANCH }), key)).status).toBe(200);
    expect(updateBranch).toHaveBeenCalledWith(S, 'mau-br-x', expect.anything());
    expect((await branchRoute.DELETE(makeRequest(`/api/seller/store/branches/mau-br-x?storeKey=${S}`, { method: 'DELETE' }), key)).status).toBe(200);
    expect(removeBranch).toHaveBeenCalledWith(S, 'mau-br-x');
  });
  it('invalid hours, zone or pickup mode are 400 and nothing is written', async () => {
    for (const bad of [{ openingHours: { mon: ['18:00', '08:00'] } }, { timezone: 'Mars/Base' }, { pickupMode: 'whenever' }, { slug: 'Not A Slug' }]) {
      const res = await branchesRoute.POST(makeRequest('/api/seller/store/branches', { method: 'POST', json: { ...BRANCH, slug: 'ok-slug', ...bad } }));
      expect(res.status).toBe(400);
    }
    expect(createBranch).not.toHaveBeenCalled();
  });
  it('Buyer is 403 for list, create, edit and remove', async () => {
    asBuyer();
    expect((await branchesRoute.GET(makeRequest(`/api/seller/store/branches?storeKey=${S}`))).status).toBe(403);
    expect((await branchesRoute.POST(makeRequest('/api/seller/store/branches', { method: 'POST', json: { ...BRANCH, slug: 'x-y' } }))).status).toBe(403);
    expect((await branchRoute.PUT(makeRequest('/api/seller/store/branches/mau-br-x', { method: 'PUT', json: BRANCH }), key)).status).toBe(403);
    expect((await branchRoute.DELETE(makeRequest(`/api/seller/store/branches/mau-br-x?storeKey=${S}`, { method: 'DELETE' }), key)).status).toBe(403);
    expect(createBranch).not.toHaveBeenCalled();
    expect(removeBranch).not.toHaveBeenCalled();
  });
});

describe('branch stock', () => {
  it('Admin lists a page and sets stock and price', async () => {
    expect((await stockListRoute.GET(makeRequest(`/api/seller/store/branches/mau-br-x/stock?storeKey=${S}&offset=50&text=brake`), key)).status).toBe(200);
    expect(listBranchStock).toHaveBeenCalledWith(S, 'mau-br-x', { offset: 50, text: 'brake' });
    const res = await stockPutRoute.PUT(makeRequest('/api/seller/store/branches/mau-br-x/stock/MLV-BP-41001', { method: 'PUT', json: { storeKey: S, availableQuantity: 7, priceCent: 8900 } }), skuCtx);
    expect(res.status).toBe(200);
    expect(setBranchStock).toHaveBeenCalledWith(S, 'mau-br-x', 'MLV-BP-41001', { availableQuantity: 7, priceCent: 8900 });
  });
  it('a SKU outside the assortment is 422 with its code', async () => {
    setBranchStock.mockRejectedValueOnce(new UnprocessableError('This part is not in your assortment', 'SKU_NOT_IN_ASSORTMENT'));
    const res = await stockPutRoute.PUT(makeRequest('/api/seller/store/branches/mau-br-x/stock/NOPE', { method: 'PUT', json: { storeKey: S, availableQuantity: 1 } }), { params: Promise.resolve({ key: 'mau-br-x', sku: 'NOPE' }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'This part is not in your assortment', code: 'SKU_NOT_IN_ASSORTMENT' });
  });
  it('price 0 or negative, bad quantity and an empty change are 400; null clears the price', async () => {
    for (const bad of [{ priceCent: 0 }, { priceCent: -1 }, { availableQuantity: -1 }, { availableQuantity: 100001 }, {}]) {
      expect((await stockPutRoute.PUT(makeRequest('/api/seller/store/branches/mau-br-x/stock/MLV-BP-41001', { method: 'PUT', json: { storeKey: S, ...bad } }), skuCtx)).status).toBe(400);
    }
    expect(setBranchStock).not.toHaveBeenCalled();
    expect((await stockPutRoute.PUT(makeRequest('/api/seller/store/branches/mau-br-x/stock/MLV-BP-41001', { method: 'PUT', json: { storeKey: S, priceCent: null } }), skuCtx)).status).toBe(200);
    expect(setBranchStock).toHaveBeenCalledWith(S, 'mau-br-x', 'MLV-BP-41001', { availableQuantity: undefined, priceCent: null });
  });
  it('Buyer is 403', async () => {
    asBuyer();
    expect((await stockListRoute.GET(makeRequest(`/api/seller/store/branches/mau-br-x/stock?storeKey=${S}`), key)).status).toBe(403);
    expect((await stockPutRoute.PUT(makeRequest('/api/seller/store/branches/mau-br-x/stock/MLV-BP-41001', { method: 'PUT', json: { storeKey: S, availableQuantity: 1 } }), skuCtx)).status).toBe(403);
    expect(setBranchStock).not.toHaveBeenCalled();
  });
});

describe('channels, geocode, theme reset, link in bio', () => {
  it('Admin 200, Buyer 403 for each', async () => {
    const calls: [string, () => Promise<Response>][] = [
      ['channels', () => channelsRoute.GET(makeRequest(`/api/seller/store/channels?storeKey=${S}`))],
      ['geocode', () => geocodeRoute.POST(makeRequest('/api/seller/store/geocode', { method: 'POST', json: { storeKey: S, address: 'Hafenallee 12 Hamburg' } }))],
      ['theme reset', () => themeRoute.DELETE(makeRequest(`/api/seller/store/theme?storeKey=${S}`, { method: 'DELETE' }))],
      ['link in bio', () => linkRoute.GET(makeRequest(`/api/seller/store/link-in-bio-status?storeKey=${S}`))],
    ];
    for (const [, call] of calls) expect((await call()).status).toBe(200);
    expect(deleteStoreTheme).toHaveBeenCalledWith(S);
    expect(loadChannelStats).toHaveBeenCalledWith(S, 30);
    asBuyer();
    for (const [, call] of calls) expect((await call()).status).toBe(403);
    expect(deleteStoreTheme).toHaveBeenCalledTimes(1);
  });
  it('the geocoder being unreachable is still a 200 with unavailable', async () => {
    geocodeAddress.mockResolvedValueOnce({ result: null, unavailable: true } as never);
    const res = await geocodeRoute.POST(makeRequest('/api/seller/store/geocode', { method: 'POST', json: { storeKey: S, address: 'Hafenallee 12 Hamburg' } }));
    expect(await res.json()).toEqual({ result: null, unavailable: true });
  });
  it('a missing Contentools connection answers 503 on reset', async () => {
    const { ApiError } = await import('@/lib/api');
    deleteStoreTheme.mockRejectedValueOnce(new ApiError(503, 'contentools_not_connected', 'CONTENTOOLS_NOT_CONNECTED'));
    const res = await themeRoute.DELETE(makeRequest(`/api/seller/store/theme?storeKey=${S}`, { method: 'DELETE' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'contentools_not_connected', code: 'CONTENTOOLS_NOT_CONNECTED' });
  });
});
