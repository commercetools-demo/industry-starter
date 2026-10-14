// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGeocoder, geocoderUserAgent, normaliseQuery } from './nominatim';

const hit = [{ display_name: 'Hafenallee 12, Hamburg, Germany', lat: '53.4609', lon: '9.9847' }];
let fetchFn: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchFn = vi.fn(async () => Response.json(hit));
});
afterEach(() => vi.useRealTimers());

const make = () => createGeocoder({ userAgent: 'malva-test/1 (ops@example.com)', fetchFn: fetchFn as unknown as typeof fetch, now: () => Date.now() });

describe('geocoder', () => {
  it('same query hits the upstream once (cached 24 h)', async () => {
    const g = make();
    const first = await g.search('Hafenallee 12  Hamburg');
    const second = await g.search('hafenallee 12 hamburg');
    expect(first.result).toEqual({ label: 'Hafenallee 12, Hamburg, Germany', lat: 53.4609, lng: 9.9847 });
    expect(second).toEqual(first);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('queue spaces two different queries by at least 1100 ms', async () => {
    const g = make();
    const times: number[] = [];
    fetchFn.mockImplementation(async () => {
      times.push(Date.now());
      return Response.json(hit);
    });
    const a = g.search('one place');
    const b = g.search('another place');
    await vi.advanceTimersByTimeAsync(2500);
    await Promise.all([a, b]);
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1100);
  });

  it('sends the identifying user agent and nothing of the visitor', async () => {
    await make().search('x place');
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://nominatim.openstreetmap.org/search?');
    expect(url).toContain('limit=1');
    expect(init.headers).toEqual({ 'User-Agent': 'malva-test/1 (ops@example.com)', Accept: 'application/json' });
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
  });

  it('upstream 429, a bad body or a network error is unavailable and not cached', async () => {
    const g = make();
    const search = async () => {
      const pending = g.search('busy place');
      await vi.advanceTimersByTimeAsync(3000);
      return pending;
    };
    fetchFn.mockResolvedValueOnce(new Response('{}', { status: 429 }));
    expect(await search()).toEqual({ result: null, unavailable: true });
    fetchFn.mockResolvedValueOnce(Response.json({ not: 'an array' }));
    expect((await search()).unavailable).toBe(true);
    fetchFn.mockRejectedValueOnce(new Error('down'));
    expect((await search()).unavailable).toBe(true);
    expect((await search()).unavailable).toBe(false);
  });

  it('no match is a result of null and not unavailable', async () => {
    fetchFn.mockResolvedValue(Response.json([]));
    expect(await make().search('nowhere')).toEqual({ result: null, unavailable: false });
  });
});

describe('helpers', () => {
  it('normaliseQuery and the user agent default', () => {
    expect(normaliseQuery('  A   B ')).toBe('a b');
    expect(geocoderUserAgent({ GEOCODER_USER_AGENT: 'x/1 (a@b.c)' })).toBe('x/1 (a@b.c)');
    expect(geocoderUserAgent({})).toContain('malva-partner-portal');
  });
});
