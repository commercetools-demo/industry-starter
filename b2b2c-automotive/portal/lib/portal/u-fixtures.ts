// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Development fixtures of workstream U (store settings, branches, branch stock, orders) behind PORTAL_DEV_FIXTURES=on, never in
// production: in-memory state shaped like the seed (seed/src/data/org.ts) so the Store & channels screens run and can be checked
// in a browser without a commercetools project (OA-01). The lib/ct/seller modules call these only when `devFixturesEnabled()`.
// No secret, no personal data; names are neutral. State lives for the life of the dev server.
import 'server-only';
import { ApiError } from '@/lib/api';
import { storefrontAddress, storefrontOrigin } from '@/lib/portal/storefront-origin';
import type { StoreLocationInput } from '@/lib/store/schemas';
import { branchKeyFor, type BranchInput, type CreateBranchInput } from '@/lib/store/schemas';
import type { Branch } from '@/lib/ct/seller/branches';
import type { StoreSettings } from '@/lib/ct/seller/store-settings';
import type { OrderFacts } from '@/lib/ct/seller/channel-stats';
import type { SalesChannel } from '@/lib/portal/share-links';

type StoreState = { name: Record<string, string>; logoUrl?: string; faviconUrl?: string; location: StoreLocationInput; currency: string; defaultCountry: string };
interface State {
  stores: Map<string, StoreState>;
  branches: Map<string, Branch[]>;
  inventory: Map<string, number>;
}

const week = (open: string, close: string, sat?: [string, string]) => ({ mon: [open, close], tue: [open, close], wed: [open, close], thu: [open, close], fri: [open, close], ...(sat ? { sat } : {}) }) as Branch['openingHours'];
const branch = (key: string, name: string, street: string, postalCode: string, city: string, lat: number, lng: number, hours: Branch['openingHours'], pickupMode: Branch['pickupMode'], phone: string): Branch => ({
  key,
  name: { 'de-DE': name, 'en-US': name },
  address: { streetName: street, postalCode, city, country: 'DE' },
  geoLocation: { lat, lng },
  openingHours: hours,
  timezone: 'Europe/Berlin',
  pickupMode,
  phone,
});

function seed(): State {
  const stores = new Map<string, StoreState>([
    ['fx-store-online', { name: { 'de-DE': 'DACH Online', 'en-US': 'DACH Online' }, location: { addressLine: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg', countryCode: 'DE', latitude: 53.4609, longitude: 9.9847 }, currency: 'EUR', defaultCountry: 'DE' }],
    ['fx-store-direct', { name: { 'de-DE': 'Workshop Direct', 'en-US': 'Workshop Direct' }, location: { addressLine: 'Werkstattstraße 8', postalCode: '10115', city: 'Berlin', countryCode: 'DE', latitude: 52.5323, longitude: 13.3846 }, currency: 'EUR', defaultCountry: 'DE' }],
    ['fx-store-south', { name: { 'de-DE': 'Süd Online', 'en-US': 'South Online' }, location: { addressLine: 'Teilestraße 21', postalCode: '81829', city: 'München', countryCode: 'DE', latitude: 48.1315, longitude: 11.6849 }, currency: 'EUR', defaultCountry: 'DE' }],
  ]);
  const branches = new Map<string, Branch[]>([
    ['fx-store-online', [
      branch('mau-br-north-one', 'Hamburg Harburg', 'Hafenallee 12', '21079', 'Hamburg', 53.4609, 9.9847, week('08:00', '19:00', ['09:00', '14:00']), 'same-day', '+49 40 0000 0100'),
      branch('mau-br-north-two', 'Bremen', 'Industriering 5', '28197', 'Bremen', 53.0698, 8.7615, week('08:00', '18:00'), 'next-day', '+49 421 0000 0300'),
    ]],
    ['fx-store-direct', [branch('mau-br-direct-one', 'Berlin Mitte', 'Werkstattstraße 8', '10115', 'Berlin', 52.5323, 13.3846, week('08:00', '20:00', ['09:00', '16:00']), 'same-day', '+49 30 0000 0200')]],
    ['fx-store-south', [
      branch('mau-br-south-one', 'München Ost', 'Teilestraße 21', '81829', 'München', 48.1315, 11.6849, week('07:30', '19:00', ['08:30', '15:00']), 'same-day', '+49 89 0000 0400'),
      { ...branch('mau-br-south-two', 'Austin', '1200 Camshaft Drive', '78744', 'Austin', 30.1972, -97.7391, week('08:00', '18:00', ['09:00', '13:00']), 'ship-to-store', '+1 512 000 0600'), address: { streetName: '1200 Camshaft Drive', postalCode: '78744', city: 'Austin', country: 'US' }, timezone: 'America/Chicago' },
    ]],
  ]);
  const inventory = new Map<string, number>([
    ['fx-store-online|mau-br-north-one|MLV-BP-41001', 12],
    ['fx-store-online|mau-br-north-one|MLV-BD-42001', 4],
    ['fx-store-online|mau-br-north-two|MLV-BP-41001', 0],
  ]);
  return { stores, branches, inventory };
}

const g = globalThis as unknown as { __malvaUFixtures?: State };
const state = (): State => (g.__malvaUFixtures ??= seed());

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function storeOf(storeKey: string): StoreState {
  const s = state().stores.get(storeKey);
  if (!s) throw new ApiError(404, 'Not found');
  return s;
}

const view = (key: string, s: StoreState): StoreSettings => ({
  key,
  name: { ...s.name },
  ...(s.logoUrl ? { logoUrl: s.logoUrl } : {}),
  ...(s.faviconUrl ? { faviconUrl: s.faviconUrl } : {}),
  location: clone(s.location),
  address: storefrontAddress(storefrontOrigin(), key),
  currency: s.currency,
  defaultCountry: s.defaultCountry,
});

const clean = (loc: StoreLocationInput): StoreLocationInput => Object.fromEntries(Object.entries(loc).filter(([, v]) => v !== undefined && v !== '')) as StoreLocationInput;

export const fixtureStoreSettings = {
  get: async (storeKey: string): Promise<StoreSettings> => view(storeKey, storeOf(storeKey)),
  save: async (storeKey: string, input: { name: Record<string, string>; location: StoreLocationInput }): Promise<StoreSettings> => {
    const s = storeOf(storeKey);
    s.name = { ...input.name };
    s.location = clean(input.location);
    return view(storeKey, s);
  },
  setAsset: async (storeKey: string, kind: 'logoUrl' | 'faviconUrl', url: string | null): Promise<StoreSettings> => {
    const s = storeOf(storeKey);
    if (url) s[kind] = url;
    else delete s[kind];
    return view(storeKey, s);
  },
};

const listOf = (storeKey: string): Branch[] => {
  storeOf(storeKey);
  const all = state().branches.get(storeKey) ?? [];
  state().branches.set(storeKey, all);
  return all;
};

const fromInput = (key: string, input: BranchInput): Branch => ({
  key,
  name: { ...input.name },
  address: { ...input.address },
  ...(input.geoLocation ? { geoLocation: { ...input.geoLocation } } : {}),
  openingHours: clone(input.openingHours),
  timezone: input.timezone,
  pickupMode: input.pickupMode,
  ...(input.phone ? { phone: input.phone } : {}),
});

export const fixtureBranches = {
  list: async (storeKey: string): Promise<Branch[]> => clone([...listOf(storeKey)].sort((a, b) => (a.key < b.key ? -1 : 1))),
  create: async (storeKey: string, input: CreateBranchInput): Promise<Branch> => {
    const all = listOf(storeKey);
    const key = branchKeyFor(storeKey, input.slug);
    if ([...state().branches.values()].flat().some((b) => b.key === key)) throw new ApiError(409, 'A branch with this short name already exists', 'BRANCH_EXISTS');
    const created = fromInput(key, input);
    all.push(created);
    return clone(created);
  },
  update: async (storeKey: string, branchKey: string, input: BranchInput): Promise<Branch> => {
    const all = listOf(storeKey);
    const index = all.findIndex((b) => b.key === branchKey);
    if (index < 0) throw new ApiError(404, 'Not found');
    all[index] = fromInput(branchKey, input);
    return clone(all[index]);
  },
  remove: async (storeKey: string, branchKey: string): Promise<void> => {
    const all = listOf(storeKey);
    const index = all.findIndex((b) => b.key === branchKey);
    if (index < 0) throw new ApiError(404, 'Not found');
    all.splice(index, 1);
  },
};

export const fixtureStock = {
  branchCountry: async (storeKey: string, branchKey: string): Promise<string> => listOf(storeKey).find((b) => b.key === branchKey)?.address.country ?? 'DE',
  quantities: async (storeKey: string, branchKey: string, skus: readonly string[]): Promise<Map<string, number>> => {
    const out = new Map<string, number>();
    for (const sku of skus) {
      const v = state().inventory.get(`${storeKey}|${branchKey}|${sku}`);
      if (v !== undefined) out.set(sku, v);
    }
    return out;
  },
  setQuantity: async (storeKey: string, branchKey: string, sku: string, quantity: number): Promise<void> => {
    state().inventory.set(`${storeKey}|${branchKey}|${sku}`, quantity);
  },
};

const order = (channel: SalesChannel | null, cents: number, isTest = false): OrderFacts => ({ channel, isTest, cents, currency: 'EUR' });

export const fixtureOrders = {
  /** A fixed mix: web with and without the field, social links, in-store, and a test order that must not count. */
  facts: (storeKey: string): OrderFacts[] => {
    storeOf(storeKey);
    return [
      order('web', 18900), order('web', 24500), order(null, 7800), order('instagram', 12900), order('instagram', 15900),
      order('facebook', 6400), order('whatsapp', 9900), order('in-store', 31200), order('in-store', 4500), order('web', 99900, true),
    ];
  },
};
