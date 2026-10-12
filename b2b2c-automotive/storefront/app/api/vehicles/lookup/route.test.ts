// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLE_RECORDS } from '@/lib/vehicles/test-fixtures';
import { makeRequest } from '@/test/request';

const tableGet = vi.hoisted(() => vi.fn());
const provider = vi.hoisted(() => ({ lookupPlate: vi.fn(), lookupVin: vi.fn() }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: { customObjects: () => ({ get: () => ({ execute: tableGet }) }) }, projectKey: 'p' }));

async function post(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import('./route');
  return POST(makeRequest('/api/vehicles/lookup', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }));
}

beforeEach(() => {
  vi.resetModules();
  provider.lookupPlate.mockReset();
  provider.lookupVin.mockReset();
  tableGet.mockReset();
  tableGet.mockResolvedValue({ body: { results: VEHICLE_RECORDS.map((r) => ({ id: r.fitmentKey, version: 1, container: 'mau-vehicles', key: 'k', value: r })) } });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/vehicles');
  vi.doUnmock('next/headers');
  vi.restoreAllMocks();
});

describe('Lookup endpoint (mock provider)', () => {
  it('valid plate returns resolved', async () => {
    const res = await post({ type: 'plate', plate: 'b-ab 1234', country: 'DE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'resolved', vehicle: { id: 'volkswagen.golf.2016.2-0-tdi', label: '2016 Volkswagen Golf · 2.0 TDI' } });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('a plate that needs the engine returns the engines', async () => {
    const body = await (await post({ type: 'plate', plate: 'HH-XY 99', country: 'DE' })).json();
    expect(body).toMatchObject({ status: 'needs-engine', year: 2016 });
  });

  it('an unknown plate is a result, not an error', async () => {
    const res = await post({ type: 'plate', plate: 'ZZ 0', country: 'DE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'not-found' });
  });

  it('invalid plate is invalid and never reaches the provider', async () => {
    vi.doMock('@/lib/vehicles', () => ({ getProvider: () => provider, isLookupEnabled: () => true }));
    expect(await (await post({ type: 'plate', plate: 'B*AB', country: 'DE' })).json()).toEqual({ status: 'invalid', reason: 'plate-format' });
    expect(provider.lookupPlate).not.toHaveBeenCalled();
  });

  it('invalid vin is invalid and never reaches the provider', async () => {
    vi.doMock('@/lib/vehicles', () => ({ getProvider: () => provider, isLookupEnabled: () => true }));
    expect(await (await post({ type: 'vin', vin: 'WVWZZZAUZGW00000' })).json()).toEqual({ status: 'invalid', reason: 'vin-length' });
    expect(await (await post({ type: 'vin', vin: 'WVWZZZAUZGW00000I' })).json()).toEqual({ status: 'invalid', reason: 'vin-characters' });
    expect(provider.lookupVin).not.toHaveBeenCalled();
  });

  it('a known vin resolves', async () => {
    expect(await (await post({ type: 'vin', vin: 'wvwzzzauzgw000001' })).json()).toMatchObject({ status: 'resolved' });
  });

  it('provider error becomes unavailable and the log has no plate', async () => {
    vi.doMock('@/lib/vehicles', () => ({ getProvider: () => provider, isLookupEnabled: () => true }));
    provider.lookupPlate.mockRejectedValue(new Error('upstream said B-AB 1234'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ type: 'plate', plate: 'B-AB 1234', country: 'DE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'unavailable' });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('B-AB');
  });

  it('a resolved vehicle the table does not know is not found', async () => {
    vi.doMock('@/lib/vehicles', () => ({ getProvider: () => provider, isLookupEnabled: () => true }));
    provider.lookupVin.mockResolvedValue({ status: 'resolved', vehicle: { id: 'x.y.2000.z', make: 'X', model: 'Y', year: 2000, engine: 'Z', label: 'l' } });
    expect(await (await post({ type: 'vin', vin: 'WVWZZZAUZGW000001' })).json()).toEqual({ status: 'not-found' });
  });

  it('rate limit returns 429', async () => {
    const cookie = { cookie: 'malva_session=abc' };
    for (let i = 0; i < 10; i += 1) expect((await post({ type: 'plate', plate: 'ZZ 0', country: 'DE' }, cookie)).status).toBe(200);
    const res = await post({ type: 'plate', plate: 'ZZ 0', country: 'DE' }, cookie);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many lookups, try again in a minute' });
    expect((await post({ type: 'plate', plate: 'ZZ 0', country: 'DE' }, { cookie: 'malva_session=other' })).status).toBe(200);
  });

  it('nothing is saved', async () => {
    const jarSet = vi.fn();
    vi.doMock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: jarSet, delete: jarSet }) }));
    await post({ type: 'plate', plate: 'B-AB 1234', country: 'DE' });
    expect(jarSet).not.toHaveBeenCalled();
  });

  it('a bad body is 400', async () => {
    expect((await post({ type: 'plate', plate: 'ZZ 0', country: 'FR' })).status).toBe(400);
    expect((await post({ type: 'other' })).status).toBe(400);
  });

  it('is not found when lookup is switched off', async () => {
    vi.stubEnv('VEHICLE_LOOKUP_ENABLED', 'false');
    expect((await post({ type: 'plate', plate: 'ZZ 0', country: 'DE' })).status).toBe(404);
  });
});
