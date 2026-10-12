// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionSecret } from '@/lib/env';
import { signSession } from '@/lib/session-core';
import { makeRequest } from '@/test/request';

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name) } : undefined) }),
}));
const getShellContext = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/shell', () => ({ getShellContext }));

const base = { storeKey: 'mau-reseller-south', distributionChannelId: 'd', supplyChannelId: 's', productSelectionId: 'p' };
const fetchMock = vi.fn();

async function load() {
  vi.resetModules();
  return (await import('./route')).GET;
}
const get = (GET: Awaited<ReturnType<typeof load>>, q: string) => GET(makeRequest(`/api/store-context/geocode?q=${encodeURIComponent(q)}`, { headers: { cookie: 'a=b', 'x-forwarded-for': '203.0.113.9', referer: 'https://shop.example.test/' } }));

beforeEach(async () => {
  jar.values.clear();
  jar.values.set('malva_session', await signSession(base, getSessionSecret()));
  getShellContext.mockReset();
  getShellContext.mockResolvedValue({ storeId: 's1', settings: { name: 'S', shipDays: { min: 1, max: 2 }, timezone: 'Europe/Berlin' }, branches: [], countries: ['DE', 'US'] });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [{ display_name: 'München', lat: '48.1', lon: '11.5' }] });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NOMINATIM_CONTACT', 'ops@example.test');
  vi.stubEnv('GEOCODER', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Nominatim proxy: GET /api/store-context/geocode', () => {
  it('geocodes with the store countries and returns label and coordinates', async () => {
    const res = await get(await load(), 'München');
    expect(await res.json()).toEqual({ results: [{ label: 'München', lat: 48.1, lng: 11.5 }], unavailable: false });
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('countrycodes')).toBe('de,us');
  });
  it('short or hostile q is 400', async () => {
    const GET = await load();
    for (const q of ['', 'ab', 'x'.repeat(101), 'bad\u0000query', 'new\nline']) {
      expect((await get(GET, q)).status, JSON.stringify(q)).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('no cookie or visitor header reaches the upstream', async () => {
    await get(await load(), 'Hamburg');
    const headers = Object.keys((fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers).map((h) => h.toLowerCase());
    expect(headers).not.toContain('cookie');
    expect(headers).not.toContain('x-forwarded-for');
    expect(headers).not.toContain('referer');
  });
  it('geocoder off makes no request', async () => {
    vi.stubEnv('GEOCODER', 'off');
    const res = await get(await load(), 'Hamburg');
    expect(await res.json()).toEqual({ results: [], unavailable: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('upstream failure answers 200 with unavailable', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const res = await get(await load(), 'Hamburg');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [], unavailable: true });
  });
  it('session rate limit returns 429', async () => {
    const GET = await load();
    for (let i = 0; i < 20; i += 1) expect((await get(GET, 'Hamburg')).status).toBe(200);
    expect((await get(GET, 'Hamburg')).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the 20 identical queries share one cached upstream call
  });
  it('without a store in the session the answer is 404', async () => {
    jar.values.clear();
    expect((await get(await load(), 'Hamburg')).status).toBe(404);
  });
});
