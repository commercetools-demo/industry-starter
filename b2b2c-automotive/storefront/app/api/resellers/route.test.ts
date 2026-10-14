// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

const listResellers = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/resellers', () => ({ listResellers }));
vi.mock('@/lib/session', () => ({ getLocale: async () => ({ locale: 'de-DE', currency: 'EUR', country: 'DE' }) }));

const resellers = [{ key: 'mau-reseller-north', name: 'North', city: 'Hamburg', postalCode: '21079', address: 'Hafenallee 12', branches: [] }];

beforeEach(() => {
  vi.resetModules();
  listResellers.mockReset();
  listResellers.mockResolvedValue(resellers);
});

describe('GET /api/resellers', () => {
  it('answers the list with no session and a short public cache', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeRequest('/api/resellers?locale=en-US'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ resellers });
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(listResellers).toHaveBeenCalledWith('en-US');
  });
  it('falls back to the visitor locale when the asked one is not supported', async () => {
    const { GET } = await import('./route');
    await GET(makeRequest('/api/resellers?locale=fr-FR'));
    expect(listResellers).toHaveBeenCalledWith('de-DE');
  });
  it('exports GET only: every other method is 405 from Next', async () => {
    const mod = (await import('./route')) as Record<string, unknown>;
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(mod[method], method).toBeUndefined();
  });
  it('an outage is a generic 500 with no detail', async () => {
    listResellers.mockRejectedValue(new Error('secret detail'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { GET } = await import('./route');
    const res = await GET(makeRequest('/api/resellers'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
  it('is rate limited per client', async () => {
    const { GET } = await import('./route');
    const call = () => GET(makeRequest('/api/resellers', { headers: { 'x-forwarded-for': '203.0.113.9' } }));
    for (let i = 0; i < 60; i += 1) expect((await call()).status).toBe(200);
    const refused = await call();
    expect(refused.status).toBe(429);
    expect(refused.headers.get('Retry-After')).toBe('60');
  });
  it('the proxy gate refuses a cross-origin POST before any handler runs', async () => {
    const { apiGate } = await import('@/lib/security/api-gate');
    const refused = apiGate({ method: 'POST', url: 'http://localhost:3000/api/resellers', headers: new Headers({ origin: 'https://evil.example', host: 'localhost:3000', 'content-type': 'application/json' }) }, '/api/resellers');
    expect(refused?.status).toBe(403);
  });
});
