// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Store, TypedMoney } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapMoney } from './money';
import { mapStore } from './store';

const ch = (id: string, key: string) => ({ typeId: 'channel' as const, id, obj: { key } });
const store = (over: Partial<Record<string, unknown>> = {}): Store =>
  ({
    id: 'store-1',
    key: 'mau-store-north',
    name: { de: 'Küstenwerk Autoteile', 'en-US': 'Küstenwerk Auto Parts' },
    countries: [{ code: 'DE' }],
    distributionChannels: [ch('d1', 'mau-dist-north')],
    supplyChannels: [ch('s1', 'mau-supply-malva')],
    productSelections: [{ productSelection: { typeId: 'product-selection', id: 'sel-1' }, active: true }],
    ...over,
  }) as unknown as Store;

describe('Store resolved from the path: mapStore', () => {
  it('Store with channels and selection maps to a context', () => {
    expect(mapStore(store())).toMatchObject({
      key: 'mau-store-north',
      storeKey: 'mau-store-north',
      distributionChannelId: 'd1',
      supplyChannelId: 's1',
      productSelectionId: 'sel-1',
      countries: ['DE'],
    });
  });
  it('Store without a product selection maps to null', () => {
    expect(mapStore(store({ productSelections: [] }))).toBeNull();
    expect(mapStore(store({ productSelections: undefined }))).toBeNull();
  });
  it('An inactive product selection does not count', () => {
    expect(mapStore(store({ productSelections: [{ productSelection: { typeId: 'product-selection', id: 'x' }, active: false }] }))).toBeNull();
  });
  it('Store without a distribution or a supply channel maps to null', () => {
    expect(mapStore(store({ distributionChannels: [] }))).toBeNull();
    expect(mapStore(store({ supplyChannels: [] }))).toBeNull();
  });
  it('Channels are chosen by ascending key', () => {
    const s = mapStore(
      store({
        distributionChannels: [ch('d-b', 'mau-br-b'), ch('d-a', 'mau-br-a'), ch('d-r', 'mau-dist-north')],
        supplyChannels: [ch('s-z', 'z'), ch('s-m', 'mau-br-a')],
      }),
    );
    expect(s?.distributionChannelId).toBe('d-a');
    expect(s?.supplyChannelId).toBe('s-m');
    expect(s?.distributionChannels.map((c) => c.key)).toEqual(['mau-br-a', 'mau-br-b', 'mau-dist-north']);
  });
  it('The localized name map is kept whole and a default name is derived', () => {
    const s = mapStore(store());
    expect(s?.nameLocalized).toEqual({ de: 'Küstenwerk Autoteile', 'en-US': 'Küstenwerk Auto Parts' });
    expect(s?.name).toBe('Küstenwerk Autoteile');
  });
  it('A store without a name falls back to its key', () => {
    expect(mapStore(store({ name: undefined }))?.name).toBe('mau-store-north');
  });
});

describe('Type boundary: mapMoney', () => {
  it('Money mapper keeps fraction digits', () => {
    const m = { type: 'highPrecision', centAmount: 1999, preciseAmount: 199912, currencyCode: 'EUR', fractionDigits: 4 } as TypedMoney;
    expect(mapMoney(m)).toEqual({ centAmount: 1999, currencyCode: 'EUR', fractionDigits: 4 });
  });
});
