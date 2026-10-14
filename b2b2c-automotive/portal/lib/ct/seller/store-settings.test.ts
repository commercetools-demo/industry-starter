// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeSettingsInput } from '@/lib/store/schemas';

interface FakeStore {
  key: string;
  version: number;
  name: Record<string, string>;
  custom?: { type: { id: string }; fields: Record<string, unknown> };
}
let store: FakeStore;
const posts: { version: number; actions: { action: string; name?: string; value?: unknown }[] }[] = [];
let conflicts = 0;
const get = vi.fn(async () => ({ body: structuredClone(store) }));
const post = vi.fn(async ({ body }: { body: (typeof posts)[number] }) => {
  posts.push(body);
  if (conflicts > 0) {
    conflicts -= 1;
    store.version += 1; // someone else wrote in between
    throw { statusCode: 409 };
  }
  store.version += 1;
  return { body: structuredClone(store) };
});
vi.mock('@/lib/ct/admin-client', () => ({
  adminRoot: { stores: () => ({ withKey: () => ({ get: () => ({ execute: () => get() }), post: (args: never) => ({ execute: () => post(args) }) }) }) },
}));

import { buildSettingsActions, getStoreSettings, mapStoreSettings, saveStoreSettings, setStoreAsset } from './store-settings';

const NAME = { 'de-DE': 'Küstenwerk', 'en-US': 'Coast Works' };
const LOCATION = { addressLine: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg', countryCode: 'DE', latitude: 53.46, longitude: 9.98 };

beforeEach(() => {
  store = { key: 'mau-reseller-north', version: 7, name: { 'de-DE': 'Alt', 'en-US': 'Old' }, custom: { type: { id: 't1' }, fields: { currency: 'EUR', defaultCountry: 'DE', logoUrl: 'https://f.example.test/a.png', city: 'Kiel', latitude: 54.3, longitude: 10.1 } } };
  posts.length = 0;
  conflicts = 0;
  get.mockClear();
  post.mockClear();
});

describe('store settings', () => {
  it('reads name, logo, location and the read-only storefront address', async () => {
    const s = await getStoreSettings('mau-reseller-north');
    expect(s.logoUrl).toBe('https://f.example.test/a.png');
    expect(s.location).toMatchObject({ city: 'Kiel', latitude: 54.3 });
    expect(s.address).toBe('http://localhost:3000/de-DE/mau-reseller-north');
    expect(s.currency).toBe('EUR');
  });

  it('a missing store is a 404', async () => {
    get.mockRejectedValueOnce({ statusCode: 404 });
    await expect(getStoreSettings('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('no edit of address field exists: only the name and the location custom fields are written', async () => {
    await saveStoreSettings('mau-reseller-north', { name: NAME, location: LOCATION });
    const actions = posts[0].actions;
    expect(actions[0]).toEqual({ action: 'setName', name: NAME });
    const fields = actions.filter((a) => a.action === 'setCustomField').map((a) => a.name);
    expect(fields.sort()).toEqual(['addressLine', 'city', 'countryCode', 'latitude', 'longitude', 'postalCode']);
    expect(actions.every((a) => ['setName', 'setCustomField'].includes(a.action))).toBe(true);
    expect(JSON.stringify(actions)).not.toMatch(/domain|subdomain|address"|storefront/i);
    expect(posts[0].version).toBe(7);
  });

  it('an empty field is cleared with null', async () => {
    await saveStoreSettings('mau-reseller-north', { name: NAME, location: { city: 'Hamburg' } });
    const cleared = posts[0].actions.filter((a) => a.action === 'setCustomField' && a.value === null).map((a) => a.name);
    expect(cleared).toEqual(expect.arrayContaining(['addressLine', 'postalCode', 'countryCode', 'latitude', 'longitude']));
  });

  it('latitude without longitude rejected (input schema), nothing is written', () => {
    const result = storeSettingsInput.safeParse({ storeKey: 'mau-reseller-north', name: NAME, location: { latitude: 10 } });
    expect(result.success).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('setCustomType before the first custom field when the store has none', async () => {
    delete store.custom;
    await saveStoreSettings('mau-reseller-north', { name: NAME, location: LOCATION });
    const actions = posts[0].actions;
    const typeIndex = actions.findIndex((a) => a.action === 'setCustomType');
    const firstField = actions.findIndex((a) => a.action === 'setCustomField');
    expect(typeIndex).toBeGreaterThanOrEqual(0);
    expect(typeIndex).toBeLessThan(firstField);
    expect(actions[typeIndex]).toMatchObject({ type: { typeId: 'type', key: 'store-settings' }, fields: {} });
  });

  it('does not set the type again when the store has it', () => {
    expect(buildSettingsActions({ custom: { type: { id: 't1' } } } as never, { location: LOCATION }).some((a) => a.action === 'setCustomType')).toBe(false);
  });

  it('409 retried with latest version', async () => {
    conflicts = 1;
    await saveStoreSettings('mau-reseller-north', { name: NAME, location: LOCATION });
    expect(posts).toHaveLength(2);
    expect(posts[0].version).toBe(7);
    expect(posts[1].version).toBe(8);
  });

  it('logo and favicon are set and cleared as custom fields, nothing else', async () => {
    await setStoreAsset('mau-reseller-north', 'faviconUrl', 'https://f.example.test/fav.png');
    expect(posts[0].actions).toEqual([{ action: 'setCustomField', name: 'faviconUrl', value: 'https://f.example.test/fav.png' }]);
    await setStoreAsset('mau-reseller-north', 'logoUrl', null);
    expect(posts[1].actions).toEqual([{ action: 'setCustomField', name: 'logoUrl', value: null }]);
  });

  it('mapStoreSettings tolerates a store without custom fields', () => {
    expect(mapStoreSettings({ key: 'k-1', name: { 'de-DE': 'x' } } as never, 'https://s.example.test')).toEqual({ key: 'k-1', name: { 'de-DE': 'x' }, location: {}, address: 'https://s.example.test/de-DE/k-1' });
  });
});
