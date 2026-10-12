// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Store, TypedMoney } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapMoney } from './money';
import { mapStore } from './store';

const channel = (key: string, id = `id-${key}`) => ({ typeId: 'channel' as const, id, obj: { key } });
const selection = (key: string, id = `sel-${key}`, active?: boolean) => ({ productSelection: { typeId: 'product-selection' as const, id, obj: { key } }, active });
const store = (over: Record<string, unknown> = {}): Store =>
  ({
    key: 'mau-store-north',
    name: { 'de-DE': 'Küstenwerk Autoteile', 'en-US': 'Küstenwerk Auto Parts' },
    countries: [{ code: 'DE' }],
    distributionChannels: [channel('mau-dist-north')],
    supplyChannels: [channel('mau-supply-malva')],
    productSelections: [selection('mau-sel-north')],
    ...over,
  }) as unknown as Store;

describe('Store resolved: mapper', () => {
  it('Store with channels and selection maps to a context', () => {
    expect(mapStore(store())).toMatchObject({
      key: 'mau-store-north',
      storeKey: 'mau-store-north',
      name: 'Küstenwerk Autoteile',
      countries: ['DE'],
      currencies: ['EUR'],
      distributionChannelId: 'id-mau-dist-north',
      supplyChannelId: 'id-mau-supply-malva',
      productSelectionId: 'sel-mau-sel-north',
    });
    expect(mapStore(store())?.nameLocalized['en-US']).toBe('Küstenwerk Auto Parts');
  });
  it('Store without a product selection maps to null', () => {
    expect(mapStore(store({ productSelections: [] }))).toBeNull();
    expect(mapStore(store({ productSelections: undefined }))).toBeNull();
    expect(mapStore(store({ productSelections: [selection('x', 'x', false)] }))).toBeNull();
  });
  it('Store without a distribution or supply channel maps to null', () => {
    expect(mapStore(store({ distributionChannels: [] }))).toBeNull();
    expect(mapStore(store({ supplyChannels: [] }))).toBeNull();
  });
  it('Channels are chosen by ascending key', () => {
    const mapped = mapStore(store({ distributionChannels: [channel('mau-z'), channel('mau-a'), channel('mau-m')], supplyChannels: [channel('s-2'), channel('s-1')] }));
    expect(mapped?.distributionChannelId).toBe('id-mau-a');
    expect(mapped?.distributionChannels.map((c) => c.key)).toEqual(['mau-a', 'mau-m', 'mau-z']);
    expect(mapped?.supplyChannelId).toBe('id-s-1');
  });
  it('The first active selection by key is chosen', () => {
    const mapped = mapStore(store({ productSelections: [selection('b'), selection('a', 'sel-a', false), selection('c')] }));
    expect(mapped?.productSelectionId).toBe('sel-b');
  });
  it('Currencies follow the store countries', () => {
    expect(mapStore(store({ countries: [{ code: 'DE' }, { code: 'US' }] }))?.currencies.sort()).toEqual(['EUR', 'USD']);
    expect(mapStore(store({ countries: [] }))?.currencies).toEqual([]);
  });
});

describe('Type boundary: money', () => {
  it('Money mapper keeps fraction digits', () => {
    const typed = { type: 'highPrecision', centAmount: 1234, currencyCode: 'EUR', fractionDigits: 4, preciseAmount: 12345678 } as TypedMoney;
    expect(mapMoney(typed)).toEqual({ centAmount: 1234, currencyCode: 'EUR', fractionDigits: 4 });
  });
});
