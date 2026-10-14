// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StandalonePrice } from '@commercetools/platform-sdk';

const get = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: { standalonePrices: () => ({ get: (args: unknown) => ({ execute: () => get(args) }) }) }, projectKey: 'p' }));

import { getStandalonePrices, mapStandalonePrice, selectStandalonePrice, type PriceCandidate, type SelectOptions } from './prices';

const BRANCH = 'ch-branch';
const RETAIL = 'ch-retail';
const NOW = new Date('2026-10-12T10:00:00Z');
const opts = { currency: 'EUR', country: 'DE', channelIds: [BRANCH, RETAIL] as [string, string], now: NOW };
const price = (centAmount: number, over: Partial<PriceCandidate> = {}): PriceCandidate => ({
  id: `p-${centAmount}-${over.channelId ?? 'base'}`,
  centAmount,
  currencyCode: 'EUR',
  fractionDigits: 2,
  country: 'DE',
  ...over,
});
const pick = (prices: PriceCandidate[], o: SelectOptions = opts) => selectStandalonePrice(prices, o)?.value.centAmount ?? null;

describe('Standalone price selection: lib/ct/prices', () => {
  it('branch price beats retail price and base price', () => {
    expect(pick([price(1000), price(900, { channelId: RETAIL }), price(1100, { channelId: BRANCH })])).toBe(1100);
  });
  it('retail price beats base price', () => {
    expect(pick([price(1000), price(900, { channelId: RETAIL })])).toBe(900);
  });
  it('base price is the fallback when neither channel has a price', () => {
    expect(pick([price(1000), price(700, { channelId: 'ch-other-store-branch' })])).toBe(1000);
  });
  it('reseller-owned item has only a retail price and resolves it', () => {
    expect(pick([price(900, { channelId: RETAIL })])).toBe(900);
  });
  it('country match beats no country', () => {
    expect(pick([price(1000, { country: undefined }), price(1200)])).toBe(1200);
    expect(pick([price(1000, { country: undefined })])).toBe(1000);
  });
  it('a price for another country is ignored', () => {
    expect(pick([price(1000, { country: 'US', currencyCode: 'EUR' })])).toBeNull();
  });
  it('no price for the currency returns null', () => {
    expect(pick([price(1000, { currencyCode: 'USD', country: 'US' })])).toBeNull();
    expect(selectStandalonePrice([], opts)).toBeNull();
  });
  it('discounted value is carried', () => {
    const selected = selectStandalonePrice([price(1000, { discounted: { centAmount: 900, currencyCode: 'EUR', fractionDigits: 2 } })], opts);
    expect(selected).toEqual({ value: { centAmount: 1000, currencyCode: 'EUR', fractionDigits: 2 }, discounted: { centAmount: 900, currencyCode: 'EUR', fractionDigits: 2 }, channelId: undefined });
  });
  it('expired or future price is ignored', () => {
    expect(pick([price(500, { validUntil: '2026-10-01T00:00:00Z' }), price(1000)])).toBe(1000);
    expect(pick([price(500, { validFrom: '2026-11-01T00:00:00Z' }), price(1000)])).toBe(1000);
    expect(pick([price(500, { validFrom: '2026-10-01T00:00:00Z', validUntil: '2026-11-01T00:00:00Z' }), price(1000)])).toBe(500);
  });
  it('zero amount is treated as no price', () => {
    expect(pick([price(0)])).toBeNull();
    expect(pick([price(0, { channelId: BRANCH }), price(1000)])).toBe(1000);
  });
  it('reports the channel of the winning price', () => {
    expect(selectStandalonePrice([price(1000), price(900, { channelId: RETAIL })], opts)?.channelId).toBe(RETAIL);
    expect(selectStandalonePrice([price(1000)], opts)?.channelId).toBeUndefined();
  });
  it('a store without a branch channel still resolves retail then base', () => {
    const o = { ...opts, channelIds: [undefined, RETAIL] as const };
    expect(pick([price(1000), price(900, { channelId: RETAIL })], o)).toBe(900);
  });
});

const sp = (sku: string, cent: number, over: Partial<StandalonePrice> = {}): StandalonePrice =>
  ({ id: `id-${sku}-${cent}`, version: 1, sku, value: { type: 'centPrecision', currencyCode: 'EUR', centAmount: cent, fractionDigits: 2 }, active: true, country: 'DE', ...over }) as StandalonePrice;

beforeEach(() => {
  get.mockReset();
});

describe('Standalone price read: lib/ct/prices', () => {
  it('maps a standalone price to a candidate', () => {
    const mapped = mapStandalonePrice(sp('a', 900, { channel: { typeId: 'channel', id: RETAIL }, discounted: { value: { type: 'centPrecision', currencyCode: 'EUR', centAmount: 800, fractionDigits: 2 }, discount: { typeId: 'product-discount', id: 'd' } } }));
    expect(mapped).toMatchObject({ centAmount: 900, currencyCode: 'EUR', country: 'DE', channelId: RETAIL, discounted: { centAmount: 800 } });
  });

  it('one standalone price call for many skus', async () => {
    get.mockResolvedValue({ body: { results: [sp('a', 1000), sp('b', 2000), sp('b', 1900, { channel: { typeId: 'channel', id: RETAIL } })] } });
    const map = await getStandalonePrices(['a', 'b', 'c'], { currency: 'EUR', channelIds: [BRANCH, RETAIL] });
    expect(get).toHaveBeenCalledTimes(1);
    const where = get.mock.calls[0][0].queryArgs.where as string;
    expect(where).toContain('sku in ("a","b","c")');
    expect(where).toContain('value(currencyCode="EUR")');
    expect(where).toContain('active=true');
    expect(where).toContain(`channel(id in ("${BRANCH}","${RETAIL}"))`);
    expect(map.get('a')).toHaveLength(1);
    expect(map.get('b')).toHaveLength(2);
    expect(map.get('c')).toBeUndefined();
  });

  it('chunks very large sku lists', async () => {
    get.mockResolvedValue({ body: { results: [] } });
    await getStandalonePrices(Array.from({ length: 120 }, (_, i) => `s${i}`), { currency: 'EUR', channelIds: [BRANCH, RETAIL] });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('no skus means no call', async () => {
    expect((await getStandalonePrices([], { currency: 'EUR', channelIds: [BRANCH, RETAIL] })).size).toBe(0);
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects a sku that could break the predicate', async () => {
    await expect(getStandalonePrices(['a"b'], { currency: 'EUR', channelIds: [BRANCH, RETAIL] })).rejects.toThrow('Invalid sku');
  });
});
