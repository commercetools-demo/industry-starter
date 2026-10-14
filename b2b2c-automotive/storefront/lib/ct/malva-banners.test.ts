// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const objectGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({
  apiRoot: { customObjects: () => ({ withContainerAndKey: (a: unknown) => ({ get: () => ({ execute: () => objectGet(a) }) }) }) },
  projectKey: 'p',
}));

const value = { banners: [{ headline: { de: 'Bremsen', en: 'Brakes' }, subline: { de: 'a', en: 'b' }, categorySlug: { de: 'bremsen', en: 'brakes' } }] };

async function load() {
  vi.resetModules();
  return (await import('./malva-banners')).getMalvaBanners;
}

beforeEach(() => {
  objectGet.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('getMalvaBanners', () => {
  it('reads container malva-site, key home-banners', async () => {
    objectGet.mockResolvedValue({ body: { value } });
    const get = await load();
    expect((await get('en-US'))[0].headline).toBe('Brakes');
    expect(objectGet).toHaveBeenCalledWith({ container: 'malva-site', key: 'home-banners' });
  });
  it('a missing object (404) gives no banners', async () => {
    objectGet.mockRejectedValue({ statusCode: 404 });
    const get = await load();
    expect(await get('en-US')).toEqual([]);
  });
  it('an outage without a previous copy gives no banners', async () => {
    objectGet.mockRejectedValue(new Error('down'));
    const get = await load();
    expect(await get('en-US')).toEqual([]);
  });
  it('a second read within the cache time does not call commercetools again', async () => {
    objectGet.mockResolvedValue({ body: { value } });
    const get = await load();
    await get('en-US');
    await get('de-DE');
    expect(objectGet).toHaveBeenCalledTimes(1);
  });
});
