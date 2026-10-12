// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn(() => ({ execute })));
const withKey = vi.hoisted(() => vi.fn(() => ({ get })));
vi.mock('./client', () => ({ apiRoot: { stores: () => ({ withKey }) }, projectKey: 'p' }));

const body = {
  id: 'store-1',
  key: 'mau-reseller-north',
  name: { 'de-DE': 'Nord', 'en-US': 'North' },
  countries: [{ code: 'DE' }],
  distributionChannels: [{ typeId: 'channel', id: 'r', obj: { id: 'r', key: 'mau-dist-north' } }],
};
const load = async () => (await import('./shell')).getShellContext;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  execute.mockReset();
  get.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('Shell carries identity: lib/ct/shell', () => {
  it('reads the store with expanded distribution channels and maps it for the locale', async () => {
    execute.mockResolvedValue({ body });
    const ctx = await (await load())('mau-reseller-north', 'en-US');
    expect(get).toHaveBeenCalledWith({ queryArgs: { expand: ['distributionChannels[*]'] } });
    expect(ctx).toMatchObject({ storeId: 'store-1', retailChannelId: 'r', settings: { name: 'North' } });
  });
  it('serves a second locale from the cache without a second read', async () => {
    execute.mockResolvedValue({ body });
    const fn = await load();
    await fn('mau-reseller-north', 'en-US');
    expect((await fn('mau-reseller-north', 'de-DE'))?.settings.name).toBe('Nord');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('an invalid key never reaches commercetools', async () => {
    expect(await (await load())('../etc', 'de-DE')).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });
  it('an unknown store is null', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    expect(await (await load())('nope-store', 'de-DE')).toBeNull();
  });
  it('an outage serves the last known store, or rethrows without one', async () => {
    execute.mockResolvedValueOnce({ body });
    const fn = await load();
    await fn('mau-reseller-north', 'de-DE');
    vi.advanceTimersByTime(61_000);
    execute.mockRejectedValue({ statusCode: 503 });
    expect((await fn('mau-reseller-north', 'de-DE'))?.storeId).toBe('store-1');
    await expect(fn('other-store', 'de-DE')).rejects.toBeDefined();
  });
});
