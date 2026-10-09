// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ apiRoot: { stores: () => ({ withKey: ({ key }: { key: string }) => ({ get: () => ({ execute: () => get(key) }) }) }) } }));
const { clearStoreCache, getDefaultStore, getStoreChannelData, storeFieldsFrom } = await import('./stores');

const store = { key: 'mpw-web', id: 's1', distributionChannels: [{ id: 'd1' }], supplyChannels: [{ id: 'u1' }], productSelections: [{ active: true, productSelection: { id: 'ps1' } }] };

beforeEach(() => { get.mockReset(); clearStoreCache(); process.env.CTP_DEFAULT_STORE_KEY = 'mpw-web'; });

describe('malva-business-unit-context › Store channel resolution', () => {
  it('maps the channel and selection ids', () => {
    expect(storeFieldsFrom(store as never)).toEqual({ storeKey: 'mpw-web', storeId: 's1', distributionChannelId: 'd1', supplyChannelId: 'u1', productSelectionId: 'ps1' });
  });
  it('One lookup per instance', async () => {
    get.mockResolvedValue({ body: store });
    await Promise.all([getStoreChannelData('mpw-web'), getStoreChannelData('mpw-web')]);
    await getStoreChannelData('mpw-web');
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('Failure is not cached', async () => {
    get.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ body: store });
    await expect(getStoreChannelData('mpw-web')).rejects.toThrow('boom');
    await expect(getStoreChannelData('mpw-web')).resolves.toMatchObject({ storeId: 's1' });
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('malva-business-unit-context › Default public store and service selection', () => {
  it('Missing store names the variable and the key', async () => {
    get.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    await expect(getDefaultStore()).rejects.toThrow(/CTP_DEFAULT_STORE_KEY.*"mpw-web".*does not exist/);
  });
  it('names the variable when unset', async () => {
    delete process.env.CTP_DEFAULT_STORE_KEY;
    await expect(getDefaultStore()).rejects.toThrow('CTP_DEFAULT_STORE_KEY');
  });
  it('Anonymous browse uses the default store', async () => {
    get.mockResolvedValue({ body: store });
    expect((await getDefaultStore()).productSelectionId).toBe('ps1');
  });
});
