// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn(() => ({ execute })));
const withKey = vi.hoisted(() => vi.fn(() => ({ get })));
vi.mock('./client', () => ({ apiRoot: { stores: () => ({ withKey }) }, projectKey: 'p' }));

const ch = (id: string, key: string) => ({ typeId: 'channel', id, obj: { key } });
const storeBody = (key = 'mau-store-north') => ({
  key,
  name: { de: 'Nord' },
  countries: [{ code: 'DE' }],
  distributionChannels: [ch('d1', 'mau-dist-north')],
  supplyChannels: [ch('s1', 'mau-supply-malva')],
  productSelections: [{ productSelection: { typeId: 'product-selection', id: 'sel-1' }, active: true }],
});

async function load() {
  return (await import('./stores')).getStoreContext;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  execute.mockReset();
  get.mockClear();
  withKey.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('Store resolved from the path: lib/ct/stores', () => {
  it('Store is read with expanded channels and mapped', async () => {
    execute.mockResolvedValue({ body: storeBody() });
    const s = await (await load())('mau-store-north');
    expect(withKey).toHaveBeenCalledWith({ key: 'mau-store-north' });
    expect(get).toHaveBeenCalledWith({ queryArgs: { expand: ['distributionChannels[*]', 'supplyChannels[*]'] } });
    expect(s).toMatchObject({ storeKey: 'mau-store-north', distributionChannelId: 'd1', supplyChannelId: 's1', productSelectionId: 'sel-1' });
  });

  it('Unknown store is null', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    expect(await (await load())('nope-store')).toBeNull();
  });

  it('Unknown store is cached for a short time', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    const getCtx = await load();
    await getCtx('nope-store');
    await getCtx('nope-store');
    expect(execute).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_001);
    await getCtx('nope-store');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('A found store is cached for 60 seconds', async () => {
    execute.mockResolvedValue({ body: storeBody() });
    const getCtx = await load();
    await getCtx('mau-store-north');
    vi.advanceTimersByTime(59_000);
    await getCtx('mau-store-north');
    expect(execute).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await getCtx('mau-store-north');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('Two stores do not share a cache entry', async () => {
    execute.mockImplementation(async () => ({ body: storeBody(withKey.mock.calls.length === 1 ? 'mau-store-north' : 'mau-store-south') }));
    const getCtx = await load();
    const a = await getCtx('mau-store-north');
    const b = await getCtx('mau-store-south');
    expect(a?.storeKey).toBe('mau-store-north');
    expect(b?.storeKey).toBe('mau-store-south');
  });

  it('Store without a product selection is null', async () => {
    execute.mockResolvedValue({ body: { ...storeBody(), productSelections: [] } });
    expect(await (await load())('mau-store-north')).toBeNull();
  });

  it('Invalid key never calls commercetools', async () => {
    const getCtx = await load();
    for (const key of ['', 'a', '../x', 'a/b', 'a b', 'x'.repeat(257), 'key;drop']) expect(await getCtx(key)).toBeNull();
    expect(withKey).not.toHaveBeenCalled();
  });

  it('Stale entry is served when commercetools fails', async () => {
    execute.mockResolvedValueOnce({ body: storeBody() });
    const getCtx = await load();
    await getCtx('mau-store-north');
    vi.advanceTimersByTime(61_000);
    execute.mockRejectedValueOnce({ statusCode: 503 });
    expect((await getCtx('mau-store-north'))?.storeKey).toBe('mau-store-north');
  });

  it('Failure without a cache entry rethrows', async () => {
    execute.mockRejectedValue({ statusCode: 503 });
    await expect((await load())('mau-store-north')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('A stale negative entry does not hide an outage', async () => {
    execute.mockRejectedValueOnce({ statusCode: 404 });
    const getCtx = await load();
    await getCtx('mau-store-north');
    vi.advanceTimersByTime(11_000);
    execute.mockRejectedValueOnce({ statusCode: 500 });
    await expect(getCtx('mau-store-north')).rejects.toBeDefined();
  });
});
