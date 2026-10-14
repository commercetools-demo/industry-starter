// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Store identity and location (workstream U-05). The store is read and written with the admin client AFTER `authorizeStore`
// (the route does that first). Edited here: the localized name, `logoUrl`, `faviconUrl` and the location fields of the seed's
// custom type `store-settings`; every other field of the type stays as seeded. The storefront address is derived and never
// stored (decision 11).
import 'server-only';
import type { Store, StoreUpdateAction } from '@commercetools/platform-sdk';
import { ApiError } from '@/lib/api';
import { adminRoot } from '@/lib/ct/admin-client';
import { devFixturesEnabled } from '@/lib/portal/seam';
import { storefrontAddress, storefrontOrigin } from '@/lib/portal/storefront-origin';
import type { StoreLocationInput, StoreSettingsInput } from '@/lib/store/schemas';
import type { StoreSettings } from '@/lib/store/types';
import { fixtureStoreSettings } from '@/lib/portal/u-fixtures';
import { isConflict, isNotFound, retryOnConflict } from './versioned';

export const STORE_SETTINGS_TYPE = 'store-settings';

export type { StoreSettings };

const text = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function mapStoreSettings(store: Pick<Store, 'key' | 'name' | 'custom'>, origin = storefrontOrigin()): StoreSettings {
  const f = (store.custom?.fields ?? {}) as Record<string, unknown>;
  return {
    key: store.key,
    name: { ...(store.name ?? {}) },
    ...(text(f.logoUrl) ? { logoUrl: text(f.logoUrl) } : {}),
    ...(text(f.faviconUrl) ? { faviconUrl: text(f.faviconUrl) } : {}),
    location: {
      ...(text(f.addressLine) ? { addressLine: text(f.addressLine) } : {}),
      ...(text(f.postalCode) ? { postalCode: text(f.postalCode) } : {}),
      ...(text(f.city) ? { city: text(f.city) } : {}),
      ...(text(f.countryCode) ? { countryCode: text(f.countryCode) } : {}),
      ...(num(f.latitude) !== undefined ? { latitude: num(f.latitude) } : {}),
      ...(num(f.longitude) !== undefined ? { longitude: num(f.longitude) } : {}),
    },
    address: storefrontAddress(origin, store.key),
    ...(text(f.currency) ? { currency: text(f.currency) } : {}),
    ...(text(f.defaultCountry) ? { defaultCountry: text(f.defaultCountry) } : {}),
  };
}

export async function getStoreSettings(storeKey: string): Promise<StoreSettings> {
  if (devFixturesEnabled()) return fixtureStoreSettings.get(storeKey);
  try {
    const { body } = await adminRoot.stores().withKey({ key: storeKey }).get().execute();
    return mapStoreSettings(body);
  } catch (error) {
    if (isNotFound(error)) throw new ApiError(404, 'Not found');
    throw error;
  }
}

const LOCATION_FIELDS = ['addressLine', 'postalCode', 'city', 'countryCode', 'latitude', 'longitude'] as const;

/** The update actions for a save: name, then one `setCustomField` per field (null clears), after `setCustomType` for a store without the type. */
export function buildSettingsActions(store: Pick<Store, 'custom'>, input: { name?: Record<string, string>; location?: StoreLocationInput; logoUrl?: string | null; faviconUrl?: string | null }): StoreUpdateAction[] {
  const actions: StoreUpdateAction[] = [];
  if (input.name) actions.push({ action: 'setName', name: input.name });
  const fields: [string, string | number | null][] = [];
  if (input.location) {
    for (const field of LOCATION_FIELDS) {
      const value = input.location[field];
      fields.push([field, value === undefined || value === '' ? null : value]);
    }
  }
  if (input.logoUrl !== undefined) fields.push(['logoUrl', input.logoUrl]);
  if (input.faviconUrl !== undefined) fields.push(['faviconUrl', input.faviconUrl]);
  if (fields.length > 0 && !store.custom?.type?.id) actions.push({ action: 'setCustomType', type: { typeId: 'type', key: STORE_SETTINGS_TYPE }, fields: {} });
  for (const [name, value] of fields) actions.push({ action: 'setCustomField', name, value });
  return actions;
}

async function update(storeKey: string, input: Parameters<typeof buildSettingsActions>[1]): Promise<StoreSettings> {
  const result = await retryOnConflict(async () => {
    const { body: store } = await adminRoot.stores().withKey({ key: storeKey }).get().execute();
    const actions = buildSettingsActions(store, input);
    if (actions.length === 0) return store;
    return (await adminRoot.stores().withKey({ key: storeKey }).post({ body: { version: store.version, actions } }).execute()).body;
  });
  return mapStoreSettings(result);
}

export async function saveStoreSettings(storeKey: string, input: Omit<StoreSettingsInput, 'storeKey'>): Promise<StoreSettings> {
  if (devFixturesEnabled()) return fixtureStoreSettings.save(storeKey, input);
  try {
    return await update(storeKey, { name: input.name, location: input.location });
  } catch (error) {
    if (isNotFound(error)) throw new ApiError(404, 'Not found');
    if (isConflict(error)) throw new ApiError(409, 'Conflict, please retry');
    throw error;
  }
}

/** Sets or clears the logo or favicon URL (the upload route validated and stored the file first). */
export async function setStoreAsset(storeKey: string, kind: 'logoUrl' | 'faviconUrl', url: string | null): Promise<StoreSettings> {
  if (devFixturesEnabled()) return fixtureStoreSettings.setAsset(storeKey, kind, url);
  try {
    return await update(storeKey, { [kind]: url });
  } catch (error) {
    if (isNotFound(error)) throw new ApiError(404, 'Not found');
    throw error;
  }
}
