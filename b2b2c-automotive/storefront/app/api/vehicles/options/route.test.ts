// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLE_RECORDS } from '@/lib/vehicles/test-fixtures';
import { makeRequest } from '@/test/request';

const tableGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/client', () => ({ apiRoot: { customObjects: () => ({ get: () => ({ execute: tableGet }) }) }, projectKey: 'p' }));

interface Options {
  level: string;
  options: Array<{ key: string; label: string; vehicleId?: string }>;
}
async function get(query: string) {
  const { GET } = await import('./route');
  return GET(makeRequest(`/api/vehicles/options${query}`));
}

beforeEach(() => {
  vi.resetModules();
  tableGet.mockReset();
  tableGet.mockResolvedValue({ body: { results: VEHICLE_RECORDS.map((r) => ({ id: r.fitmentKey, version: 1, container: 'mau-vehicles', key: 'k', value: r })) } });
});

describe('Vehicle options endpoint (dependent selectors)', () => {
  it('returns makes', async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Options;
    expect(body.level).toBe('make');
    expect(body.options.map((o) => o.key)).toContain('volkswagen');
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(res.headers.get('netlify-vary')).toBe('query');
  });

  it('the market limits the makes', async () => {
    const de = ((await (await get('?market=DE')).json()) as Options).options.map((o) => o.key);
    const us = ((await (await get('?market=US')).json()) as Options).options.map((o) => o.key);
    expect(de).not.toContain('chevrolet');
    expect(us).toContain('chevrolet');
    expect(us).not.toContain('volkswagen');
  });

  it('models need a valid make', async () => {
    const ok = (await (await get('?make=volkswagen')).json()) as Options;
    expect(ok).toMatchObject({ level: 'model', options: [{ key: 'golf', label: 'Golf' }] });
    expect((await get('?make=nope')).status).toBe(404);
    expect(await (await get('?make=nope')).json()).toEqual({ error: 'unknown-option' });
  });

  it('a model without a make is invalid', async () => {
    expect((await get('?model=golf')).status).toBe(400);
  });

  it('years descending and cover the whole range', async () => {
    const body = (await (await get('?make=volkswagen&model=golf')).json()) as Options;
    expect(body.level).toBe('year');
    const years = body.options.map((o) => Number(o.key));
    expect(years[0]).toBe(2024);
    expect(years[years.length - 1]).toBe(2012);
    expect(years).toContain(2015);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it('engines depend on the year', async () => {
    const y2016 = (await (await get('?make=volkswagen&model=golf&year=2016')).json()) as Options;
    expect(y2016.options.map((o) => o.label)).toEqual(['1.4 TSI', '2.0 TDI']);
    const y2019 = (await (await get('?make=volkswagen&model=golf&year=2019')).json()) as Options;
    expect(y2019.options.map((o) => o.label)).toEqual(['1.4 TSI', '1.5 TSI', '2.0 TDI']);
  });

  it('engines carry vehicle ids', async () => {
    const body = (await (await get('?make=volkswagen&model=golf&year=2016')).json()) as Options;
    expect(body.level).toBe('engine');
    expect(body.options.find((o) => o.label === '2.0 TDI')?.vehicleId).toBe('volkswagen.golf.2016.2-0-tdi');
  });

  it('unknown make 404', async () => {
    expect((await get('?make=nope&model=golf&year=2016')).status).toBe(404);
    expect((await get('?make=volkswagen&model=nope')).status).toBe(404);
    expect((await get('?make=volkswagen&model=golf&year=1990')).status).toBe(404);
  });

  it('malformed parameters are 400', async () => {
    expect((await get('?make=Volkswagen')).status).toBe(400);
    expect((await get('?make=volkswagen&model=golf&year=abc')).status).toBe(400);
    expect((await get('?market=FR')).status).toBe(400);
    expect((await get('?year=2016')).status).toBe(400);
  });

  it('a table outage is a 500 without details and is not cached', async () => {
    tableGet.mockRejectedValue({ statusCode: 503, message: 'detail' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await get('');
    expect(res.status).toBe(500);
    expect(res.headers.get('cache-control') ?? '').not.toContain('public');
  });
});
