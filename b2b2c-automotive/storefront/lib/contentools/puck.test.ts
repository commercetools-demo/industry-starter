// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const page = { puckData: { content: [{ type: 'Text', props: { id: 'a' } }], root: { props: {} } }, slug: '/home' };
const fetchMock = vi.fn();

async function load() {
  vi.resetModules();
  vi.stubEnv('CONTENTOOLS_ORIGIN', 'https://cms.example.com/');
  vi.stubEnv('CTP_PROJECT_KEY', 'proj-1');
  return import('./puck');
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Contentools reads and the same-origin proxy: published page', () => {
  it('Published page returns puckData', async () => {
    fetchMock.mockResolvedValue(json(page));
    const { getPublishedPage } = await load();
    expect(await getPublishedPage('mau-reseller-north')).toEqual(page.puckData);
  });
  it('404 returns null', async () => {
    fetchMock.mockResolvedValue(json({ message: 'Published puck page not found' }, 404));
    const { getPublishedPage } = await load();
    expect(await getPublishedPage('mau-reseller-north')).toBeNull();
  });
  it('Network error returns null', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const { getPublishedPage } = await load();
    expect(await getPublishedPage('mau-reseller-north')).toBeNull();
  });
  it('Empty content returns null', async () => {
    fetchMock.mockResolvedValue(json({ puckData: { content: [], root: {} } }));
    const { getPublishedPage } = await load();
    expect(await getPublishedPage('mau-reseller-north')).toBeNull();
    fetchMock.mockResolvedValue(json({ puckData: {} }));
    expect(await getPublishedPage('mau-reseller-south')).toBeNull();
    fetchMock.mockResolvedValue(json(null));
    expect(await getPublishedPage('mau-reseller-other')).toBeNull();
  });
  it('Request shape', async () => {
    fetchMock.mockResolvedValue(json(page));
    const { getPublishedPage } = await load();
    await getPublishedPage('mau-reseller-north', '/home');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next?: { revalidate: number } }];
    expect(url).toBe('https://cms.example.com/service/mau-reseller-north/published/puck-pages/query');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-project-key': 'proj-1' });
    expect(init.body).toBe(JSON.stringify({ query: 'slug = "/home"' }));
    expect(init.next).toEqual({ revalidate: 30 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('Store key is encoded', async () => {
    fetchMock.mockResolvedValue(json(page));
    const { getPublishedPage } = await load();
    await getPublishedPage('ab-cd_01');
    expect(fetchMock.mock.calls[0][0]).toContain('/service/ab-cd_01/');
  });
  it('Slug with a quote is rejected without a request', async () => {
    const { getPublishedPage } = await load();
    for (const slug of ['/a"b', '/a\\b', '/a b', 'home', '/', '/a"; drop', '/a\nb']) {
      expect(await getPublishedPage('mau-reseller-north', slug)).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Invalid store key is rejected without a request', async () => {
    const { getPublishedPage } = await load();
    for (const key of ['', 'a', '../x', 'a/b', 'a b', 'x'.repeat(257)]) expect(await getPublishedPage(key)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Different slugs each call fetch', async () => {
    fetchMock.mockResolvedValue(json(page));
    const { getPublishedPage } = await load();
    await getPublishedPage('mau-reseller-north', '/home');
    await getPublishedPage('mau-reseller-north', '/about');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][1].body)).toContain('/about');
  });
});
