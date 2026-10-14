// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGeocoder, normaliseQuery } from './nominatim';

const hit = [{ display_name: 'Hamburg, Deutschland', lat: '53.55', lon: '10.0' }, { display_name: 'junk', lat: 'x', lon: '1' }];
const okResponse = (body: unknown = hit) => ({ ok: true, status: 200, json: async () => body }) as Response;

let fetchFn: ReturnType<typeof vi.fn>;
const make = (over: Record<string, unknown> = {}) => createGeocoder({ url: 'https://nominatim.example.test', contact: 'ops@example.test', fetchFn: fetchFn as unknown as typeof fetch, ...over });
const opts = { countries: ['DE'], locale: 'de-DE' };

beforeEach(() => {
  vi.useFakeTimers();
  fetchFn = vi.fn(async () => okResponse());
});
afterEach(() => vi.useRealTimers());

describe('Nominatim proxy: geocoder', () => {
  it('same query hits the upstream once', async () => {
    const g = make();
    const first = await g.search('  Hamburg ', opts);
    const second = await g.search('hamburg', opts);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first).toEqual({ results: [{ label: 'Hamburg, Deutschland', lat: 53.55, lng: 10 }], unavailable: false });
  });
  it('concurrent identical queries share one upstream call', async () => {
    const g = make();
    await Promise.all([g.search('Hamburg', opts), g.search('hamburg', opts)]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
  it('queue spaces two different queries by at least 1100 ms', async () => {
    const times: number[] = [];
    fetchFn.mockImplementation(async () => {
      times.push(Date.now());
      return okResponse();
    });
    const g = make();
    const a = g.search('Hamburg', opts);
    const b = g.search('Berlin', opts);
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all([a, b]);
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1100);
  });
  it('user agent carries the contact', async () => {
    await make().search('Hamburg', opts);
    const init = fetchFn.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['User-Agent']).toMatch(/^malva-automotive-storefront\/\S+ \(ops@example\.test\)$/);
  });
  it('country codes come from the store', async () => {
    await make().search('Austin', { countries: ['DE', 'US'], locale: 'en-US' });
    const url = new URL(fetchFn.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('countrycodes')).toBe('de,us');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('accept-language')).toBe('en-US');
    expect(url.searchParams.get('q')).toBe('austin');
  });
  it('upstream 429 or timeout degrades without throwing', async () => {
    fetchFn.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) } as Response);
    const g = make();
    expect(await g.search('Hamburg', opts)).toEqual({ results: [], unavailable: true });
    fetchFn.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))));
    const slow = g.search('Berlin', opts);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await slow).toEqual({ results: [], unavailable: true });
    fetchFn.mockRejectedValueOnce(new Error('network'));
    const failed = g.search('Bremen', opts);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await failed).toEqual({ results: [], unavailable: true });
  });
  it('an unavailable answer is not cached', async () => {
    fetchFn.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response);
    const g = make();
    await g.search('Hamburg', opts);
    const retry = g.search('Hamburg', opts);
    await vi.advanceTimersByTimeAsync(2000);
    expect((await retry).unavailable).toBe(false);
  });
  it('no cookie or visitor header reaches the upstream', async () => {
    await make().search('Hamburg', opts);
    const init = fetchFn.mock.calls[0][1] as { headers: Record<string, string>; credentials: string; referrerPolicy: string };
    expect(Object.keys(init.headers).map((h) => h.toLowerCase()).sort()).toEqual(['accept', 'user-agent']);
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
  });
  it('the cache is bounded', async () => {
    const g = make({ maxEntries: 2, minGapMs: 0 });
    for (const q of ['aaa', 'bbb', 'ccc']) await g.search(q, opts);
    await g.search('aaa', opts); // evicted: fetched again
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
  it('cache entries expire after the TTL', async () => {
    const g = make({ ttlMs: 1000 });
    await g.search('Hamburg', opts);
    await vi.advanceTimersByTimeAsync(1500);
    const again = g.search('Hamburg', opts);
    await vi.advanceTimersByTimeAsync(2000);
    await again;
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('normalises whitespace and case', () => {
    expect(normaliseQuery('  Bad   Homburg ')).toBe('bad homburg');
  });
});
