// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ get: vi.fn(), withKey: vi.fn() }));

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    stores: () => ({
      withKey: (arg: { key: string }) => {
        sdk.withKey(arg);
        return { get: (args: unknown) => ({ execute: () => sdk.get(args) }) };
      },
    }),
  },
}));

const channel = (key: string) => ({ typeId: 'channel', id: `id-${key}`, obj: { key } });
const body = (key: string) => ({
  key,
  name: { 'de-DE': key },
  countries: [{ code: 'DE' }],
  distributionChannels: [channel('d')],
  supplyChannels: [channel('s')],
  productSelections: [{ productSelection: { typeId: 'product-selection', id: 'sel', obj: { key: 'k' } } }],
});

beforeEach(async () => {
  sdk.get.mockReset();
  sdk.withKey.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T10:00:00Z'));
  (await import('./stores')).clearStoreCache();
});
afterEach(() => vi.useRealTimers());

describe('Store resolved: lookup', () => {
  it('Store with channels and selection maps to a context', async () => {
    sdk.get.mockResolvedValue({ body: body('mau-store-north') });
    const { getStoreContext, getStoreChannelData } = await import('./stores');
    expect(await getStoreContext('mau-store-north')).toMatchObject({ storeKey: 'mau-store-north', distributionChannelId: 'id-d', supplyChannelId: 'id-s', productSelectionId: 'sel' });
    expect(await getStoreChannelData('mau-store-north')).toEqual({ storeKey: 'mau-store-north', distributionChannelId: 'id-d', supplyChannelId: 'id-s', productSelectionId: 'sel' });
    expect(sdk.get).toHaveBeenCalledTimes(1);
    expect(sdk.get.mock.calls[0][0]).toEqual({ queryArgs: { expand: ['distributionChannels[*]', 'supplyChannels[*]', 'productSelections[*].productSelection'] } });
  });
  it('Cache hit within the TTL, refetch after it', async () => {
    sdk.get.mockResolvedValue({ body: body('mau-store-north') });
    const { getStoreContext } = await import('./stores');
    await getStoreContext('mau-store-north');
    vi.advanceTimersByTime(59_000);
    await getStoreContext('mau-store-north');
    expect(sdk.get).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await getStoreContext('mau-store-north');
    expect(sdk.get).toHaveBeenCalledTimes(2);
  });
  it('Unknown store is null', async () => {
    sdk.get.mockRejectedValue({ statusCode: 404 });
    const { getStoreContext, getStoreChannelData } = await import('./stores');
    expect(await getStoreContext('mau-nope')).toBeNull();
    expect(await getStoreContext('mau-nope')).toBeNull();
    expect(sdk.get).toHaveBeenCalledTimes(1);
    await expect(getStoreChannelData('mau-nope')).rejects.toThrow('Store not available');
  });
  it('Invalid key never calls commercetools', async () => {
    const { getStoreContext } = await import('./stores');
    for (const key of ['', 'a', '../x', 'a b', 'x'.repeat(257), 'de-DE/evil']) expect(await getStoreContext(key)).toBeNull();
    expect(sdk.withKey).not.toHaveBeenCalled();
  });
  it('Stale entry is served when commercetools fails', async () => {
    sdk.get.mockResolvedValueOnce({ body: body('mau-store-north') });
    const { getStoreContext } = await import('./stores');
    const first = await getStoreContext('mau-store-north');
    vi.advanceTimersByTime(120_000);
    sdk.get.mockRejectedValue({ statusCode: 503 });
    expect(await getStoreContext('mau-store-north')).toEqual(first);
  });
  it('Failure without a cache entry rethrows', async () => {
    sdk.get.mockRejectedValue({ statusCode: 503 });
    const { getStoreContext } = await import('./stores');
    await expect(getStoreContext('mau-store-north')).rejects.toMatchObject({ statusCode: 503 });
  });
  it('A store that cannot serve is null and cached', async () => {
    sdk.get.mockResolvedValue({ body: { ...body('mau-store-north'), productSelections: [] } });
    const { getStoreContext } = await import('./stores');
    expect(await getStoreContext('mau-store-north')).toBeNull();
    expect(await getStoreContext('mau-store-north')).toBeNull();
    expect(sdk.get).toHaveBeenCalledTimes(1);
  });
});
