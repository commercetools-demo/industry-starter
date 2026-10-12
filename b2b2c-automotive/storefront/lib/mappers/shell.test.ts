// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Channel, Store } from '@commercetools/platform-sdk';
import { describe, expect, it, vi } from 'vitest';
import { mapBranch, mapShellContext, mapStoreSettings } from './shell';

const channel = (over: Record<string, unknown> = {}): Channel =>
  ({
    id: 'ch-1',
    key: 'mau-br-north-hamburg',
    name: { 'de-DE': 'Küstenwerk Hamburg', 'en-US': 'Kuestenwerk Hamburg' },
    address: { country: 'DE', streetName: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg' },
    geoLocation: { type: 'Point', coordinates: [9.9847, 53.4609] },
    custom: {
      type: { typeId: 'type', id: 't' },
      fields: { openingHours: JSON.stringify({ mon: ['08:00', '19:00'] }), timezone: 'Europe/Berlin', pickupMode: 'same-day', phone: '+49 40 1' },
    },
    ...over,
  }) as unknown as Channel;

const store = (over: Record<string, unknown> = {}): Store =>
  ({
    id: 'store-1',
    key: 'mau-reseller-north',
    name: { 'de-DE': 'Küstenwerk Autoteile', 'en-US': 'Küstenwerk Auto Parts' },
    countries: [{ code: 'DE' }],
    custom: { type: { typeId: 'type', id: 'x' }, fields: { freeShippingThresholdCent: 15000, currency: 'EUR', shipDaysMin: 2, shipDaysMax: 3, timezone: 'Europe/Berlin', logoUrl: '' } },
    distributionChannels: [
      { typeId: 'channel', id: 'r', obj: { id: 'r', key: 'mau-dist-north', name: {} } },
      { typeId: 'channel', id: 'b2', obj: channel({ id: 'b2', key: 'mau-br-north-berlin' }) },
      { typeId: 'channel', id: 'b1', obj: channel({ id: 'b1' }) },
    ],
    ...over,
  }) as unknown as Store;

describe('Shell carries identity: store settings', () => {
  it('maps the settings with the localized name', () => {
    expect(mapStoreSettings(store(), 'en-US')).toMatchObject({ name: 'Küstenwerk Auto Parts', freeShippingThresholdCent: 15000, currency: 'EUR', shipDays: { min: 2, max: 3 }, timezone: 'Europe/Berlin' });
  });
  it('uses store name when logoUrl is absent', () => {
    const s = mapStoreSettings(store(), 'de-DE');
    expect(s.logoUrl).toBeUndefined();
    expect(s.name).toBe('Küstenwerk Autoteile');
  });
  it('drops javascript and data URLs from settings links', () => {
    const custom = { type: { typeId: 'type', id: 'x' }, fields: { helpUrl: 'javascript:alert(1)', trackUrl: 'https://track.example.com/x', logoUrl: 'data:text/html,x' } };
    const s = mapStoreSettings(store({ custom }), 'de-DE');
    expect(s.helpUrl).toBeUndefined();
    expect(s.logoUrl).toBeUndefined();
    expect(s.trackUrl).toBe('https://track.example.com/x');
  });
  it('a store without settings gets defaults and its key as name', () => {
    expect(mapStoreSettings(store({ custom: undefined, name: undefined }), 'de-DE')).toMatchObject({ name: 'mau-reseller-north', shipDays: { min: 2, max: 3 } });
  });
});

describe('Choose a store: branches', () => {
  it('maps a branch with hours', () => {
    expect(mapBranch(channel(), 'de-DE')).toEqual({
      key: 'mau-br-north-hamburg',
      channelId: 'ch-1',
      name: 'Küstenwerk Hamburg',
      address: { street: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg' },
      geo: { lat: 53.4609, lng: 9.9847 },
      hours: { mon: ['08:00', '19:00'] },
      timezone: 'Europe/Berlin',
      pickupMode: 'same-day',
      phone: '+49 40 1',
    });
  });
  it('treats malformed hours as closed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const openingHours of ['{not json', JSON.stringify({ mon: ['8am', '7pm'] }), JSON.stringify({ funday: ['08:00', '09:00'] })]) {
      const c = channel({ custom: { type: { typeId: 'type', id: 't' }, fields: { openingHours, timezone: 'Europe/Berlin', pickupMode: 'next-day' } } });
      expect(mapBranch(c, 'de-DE')?.hours).toEqual({});
    }
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });
  it('a channel without branch-info is not a branch', () => {
    expect(mapBranch(channel({ custom: undefined }), 'de-DE')).toBeNull();
  });
  it('the branch timezone is its own (Austin)', () => {
    const c = channel({ custom: { type: { typeId: 'type', id: 't' }, fields: { openingHours: '{}', timezone: 'America/Chicago', pickupMode: 'ship-to-store' } } });
    expect(mapBranch(c, 'en-US')).toMatchObject({ timezone: 'America/Chicago', pickupMode: 'ship-to-store' });
  });
});

describe('Choose a store: shell context', () => {
  it('picks branches by branch-info, sorted by key, and the retail channel', () => {
    const ctx = mapShellContext(store(), 'de-DE');
    expect(ctx.branches.map((b) => b.key)).toEqual(['mau-br-north-berlin', 'mau-br-north-hamburg']);
    expect(ctx.retailChannelId).toBe('r');
    expect(ctx.storeId).toBe('store-1');
    expect(ctx.countries).toEqual(['DE']);
  });
  it('a store with no branches has an empty list', () => {
    expect(mapShellContext(store({ distributionChannels: [] }), 'de-DE').branches).toEqual([]);
  });
});
