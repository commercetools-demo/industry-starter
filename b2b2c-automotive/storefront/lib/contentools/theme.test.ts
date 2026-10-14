// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const theme = { colorPrimary: '#1f6f43' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function load() {
  vi.resetModules();
  vi.stubEnv('CONTENTOOLS_ORIGIN', 'https://cms.example.com');
  vi.stubEnv('CTP_PROJECT_KEY', 'proj-1');
  return import('./theme');
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Theme read, sanitised, applied at first paint: theme read', () => {
  it('Branches share the store theme', async () => {
    fetchMock.mockResolvedValue(json(theme));
    const { getStoreTheme } = await load();
    expect(await getStoreTheme('mau-reseller-north')).toEqual(theme);
    expect(await getStoreTheme('mau-reseller-north')).toEqual(theme);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('No theme saved', async () => {
    fetchMock.mockResolvedValue(json({ message: 'nope' }, 404));
    const { getStoreTheme } = await load();
    expect(await getStoreTheme('qa-none')).toBeNull();
    expect(await getStoreTheme('qa-none')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // the missing theme is cached too
  });
  it('Null body gives null', async () => {
    fetchMock.mockResolvedValue(json(null));
    const { getStoreTheme } = await load();
    expect(await getStoreTheme('qa-none')).toBeNull();
  });
  it('Contentools unavailable', async () => {
    fetchMock.mockResolvedValueOnce(json(theme));
    const { getStoreTheme } = await load();
    expect(await getStoreTheme('mau-reseller-north')).toEqual(theme);
    vi.advanceTimersByTime(61_000);
    fetchMock.mockResolvedValue(new Response('down', { status: 503 }));
    expect(await getStoreTheme('mau-reseller-north')).toEqual(theme); // last good
    expect(await getStoreTheme('mau-reseller-south')).toBeNull(); // fresh key, nothing to fall back to
  });
  it('Theme changes apply after the TTL', async () => {
    fetchMock.mockResolvedValueOnce(json({ colorPrimary: '#1f6f43' }));
    const { getStoreTheme } = await load();
    expect(await getStoreTheme('qa-green')).toEqual({ colorPrimary: '#1f6f43' });
    fetchMock.mockResolvedValue(json({ colorPrimary: '#8e1f0b' }));
    vi.advanceTimersByTime(30_000);
    expect(await getStoreTheme('qa-green')).toEqual({ colorPrimary: '#1f6f43' });
    vi.advanceTimersByTime(31_000);
    expect(await getStoreTheme('qa-green')).toEqual({ colorPrimary: '#8e1f0b' });
  });
  it('Request shape', async () => {
    fetchMock.mockResolvedValue(json(theme));
    const { getStoreTheme } = await load();
    await getStoreTheme('mau-reseller-north');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://cms.example.com/service/mau-reseller-north/configuration/theme');
    expect(init.headers).toEqual({ 'x-project-key': 'proj-1' });
    expect(init.cache).toBe('no-store');
    expect(init.method).toBeUndefined();
    const headerNames = Object.keys(init.headers as Record<string, string>).map((h) => h.toLowerCase());
    expect(headerNames).not.toContain('cookie');
    expect(headerNames).not.toContain('authorization');
  });
  it('Timeout falls back', async () => {
    fetchMock.mockResolvedValueOnce(json(theme));
    const { getStoreTheme } = await load();
    await getStoreTheme('mau-reseller-north');
    vi.advanceTimersByTime(61_000);
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    expect(await getStoreTheme('mau-reseller-north')).toEqual(theme);
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('Invalid key uses default', async () => {
    fetchMock.mockResolvedValue(json(theme));
    const { getStoreTheme } = await load();
    for (const key of [null, undefined, '', 'a', '../etc', 'a/b', 'x y']) {
      fetchMock.mockClear();
      vi.advanceTimersByTime(61_000);
      await getStoreTheme(key);
      expect(fetchMock.mock.calls[0][0]).toBe('https://cms.example.com/service/default/configuration/theme');
    }
  });
  it('Failure is not cached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const { getStoreTheme } = await load();
    expect(await getStoreTheme('qa-flaky')).toBeNull();
    fetchMock.mockResolvedValueOnce(json(theme));
    expect(await getStoreTheme('qa-flaky')).toEqual(theme); // the next call retries at once
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('Garbage body is a failure, not a theme', async () => {
    fetchMock.mockResolvedValue(json(['x']));
    const { getStoreTheme } = await load();
    expect(await getStoreTheme('qa-garbage')).toBeNull();
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
    expect(await getStoreTheme('qa-garbage2')).toBeNull();
  });
});
