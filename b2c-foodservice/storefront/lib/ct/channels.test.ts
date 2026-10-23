// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { channelFixture } from '@/lib/mappers/__fixtures__/channels';

const { execute, get, cachedPublic } = vi.hoisted(() => {
  const execute = vi.fn();
  return {
    execute,
    get: vi.fn(() => ({ execute })),
    cachedPublic: [] as Array<{ kind: string; parts: string[] }>,
  };
});

vi.mock('@/lib/ct/client', () => ({ apiRoot: { channels: () => ({ get }) } }));
vi.mock('@/lib/ct/public-cache', () => ({
  cachedPublic: (kind: string, parts: string[], fn: unknown) => {
    cachedPublic.push({ kind, parts });
    return fn;
  },
}));

import { getChannelByKey, getStoreChannels, getStoresForCountry } from '@/lib/ct/channels';
import { TAG } from '@/lib/cache-keys';

beforeEach(() => {
  execute.mockReset();
  get.mockClear();
});

describe('lib/ct/channels', () => {
  it('channel list is cached with tag channels', () => {
    // cachedPublic('channels', ...) is evaluated when the module loads.
    expect(cachedPublic).toContainEqual({ kind: 'channels', parts: ['store-channels'] });
    expect(TAG.channels).toBe('channels');
  });

  it('asks for InventorySupply channels only and keeps only mcf-store keys', async () => {
    execute.mockResolvedValue({
      body: {
        results: [
          channelFixture({ id: '1', key: 'mcf-store-nyc-soho' }),
          channelFixture({ id: '2', key: 'warehouse-main' }),
        ],
      },
    });
    const stores = await getStoreChannels('en-US');
    expect(get).toHaveBeenCalledWith({ queryArgs: { where: 'roles contains any ("InventorySupply")', limit: 500 } });
    expect(stores.map((s) => s.key)).toEqual(['mcf-store-nyc-soho']);
  });

  it('filters by country and finds one by key', async () => {
    execute.mockResolvedValue({ body: { results: [channelFixture()] } });
    expect(await getStoresForCountry('CA', 'en-CA')).toEqual([]);
    expect((await getStoresForCountry('US', 'en-US')).length).toBe(1);
    expect((await getChannelByKey('mcf-store-nyc-soho', 'en-US'))?.id).toBe('ch-soho');
    expect(await getChannelByKey('nope', 'en-US')).toBeNull();
  });
});
