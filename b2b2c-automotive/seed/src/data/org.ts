// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { AssociateRoleDraft, ChannelDraft, StoreDraft } from '@commercetools/platform-sdk';
import { CONTRACT_TYPE_KEYS, K, ls, slugify } from './base';
import { findFitmentKey } from './vehicles';

// ---------- channels ----------
export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** `branch-info.openingHours` JSON: `{ "mon": ["08:00","20:00"], ... }`; a missing day means closed (workstream I contract). */
export type OpeningHours = Partial<Record<Day, [string, string]>>;
/** `branch-info.pickupMode` (workstream I contract). */
export type PickupMode = 'same-day' | 'next-day' | 'ship-to-store';

export interface BranchDef {
  key: string;
  store: string;
  name: { de: string; en: string };
  street: string;
  postalCode: string;
  city: string;
  country: 'DE' | 'US';
  lat: number;
  lng: number;
  hours: OpeningHours;
  /** IANA zone of the opening hours. */
  timezone: string;
  pickup: PickupMode;
  phone: string;
}

const pair = (range: string): [string, string] => {
  const [open, close] = range.split('-') as [string, string];
  return [open, close];
};
/** Monday to Friday `open`, Saturday `sat` (or closed), Sunday closed. */
const week = (open: string, sat: string | null): OpeningHours => ({
  mon: pair(open), tue: pair(open), wed: pair(open), thu: pair(open), fri: pair(open), ...(sat ? { sat: pair(sat) } : {}),
});

export const BRANCHES: BranchDef[] = [
  { key: 'mau-br-north-hamburg', store: K.storeNorth, name: { de: 'Küstenwerk Hamburg-Harburg', en: 'Küstenwerk Hamburg-Harburg' }, street: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg', country: 'DE', lat: 53.4609, lng: 9.9847, hours: week('08:00-19:00', '09:00-14:00'), timezone: 'Europe/Berlin', pickup: 'same-day', phone: '+49 40 5550 0100' },
  { key: 'mau-br-north-berlin', store: K.storeNorth, name: { de: 'Küstenwerk Berlin-Mitte', en: 'Küstenwerk Berlin-Mitte' }, street: 'Werkstattstraße 8', postalCode: '10115', city: 'Berlin', country: 'DE', lat: 52.5323, lng: 13.3846, hours: week('08:00-20:00', '09:00-16:00'), timezone: 'Europe/Berlin', pickup: 'same-day', phone: '+49 30 5550 0200' },
  { key: 'mau-br-north-bremen', store: K.storeNorth, name: { de: 'Küstenwerk Bremen', en: 'Küstenwerk Bremen' }, street: 'Industriering 5', postalCode: '28197', city: 'Bremen', country: 'DE', lat: 53.0698, lng: 8.7615, hours: week('08:00-18:00', null), timezone: 'Europe/Berlin', pickup: 'next-day', phone: '+49 421 5550 0300' },
  { key: 'mau-br-south-munich', store: K.storeSouth, name: { de: 'Südkamm München-Ost', en: 'Südkamm Munich East' }, street: 'Teilestraße 21', postalCode: '81829', city: 'München', country: 'DE', lat: 48.1315, lng: 11.6849, hours: week('07:30-19:00', '08:30-15:00'), timezone: 'Europe/Berlin', pickup: 'same-day', phone: '+49 89 5550 0400' },
  { key: 'mau-br-south-stuttgart', store: K.storeSouth, name: { de: 'Südkamm Stuttgart', en: 'Südkamm Stuttgart' }, street: 'Kolbenweg 3', postalCode: '70376', city: 'Stuttgart', country: 'DE', lat: 48.8094, lng: 9.2193, hours: week('08:00-18:30', '09:00-13:00'), timezone: 'Europe/Berlin', pickup: 'same-day', phone: '+49 711 5550 0500' },
  { key: 'mau-br-south-austin', store: K.storeSouth, name: { de: 'Südkamm Austin', en: 'Südkamm Austin' }, street: '1200 Camshaft Drive', postalCode: '78744', city: 'Austin', country: 'US', lat: 30.1972, lng: -97.7391, hours: week('08:00-18:00', '09:00-13:00'), timezone: 'America/Chicago', pickup: 'ship-to-store', phone: '+1 512 555 0600' },
];

const DC_ADDRESS = { country: 'DE', streetName: 'Logistikring', streetNumber: '1', postalCode: '34123', city: 'Kassel' };

/**
 * Channels. The warehouse only supplies stock. Each reseller has one retail-price channel (`ProductDistribution`). A branch
 * is BOTH a supply channel and a distribution channel (Q-005): it carries stock and, optionally, its own standalone prices.
 */
export const channelDrafts: ChannelDraft[] = [
  {
    key: K.supplyMalva, roles: ['InventorySupply'], name: ls('Malva Zentrallager', 'Malva central warehouse'),
    address: DC_ADDRESS, geoLocation: { type: 'Point', coordinates: [9.5, 51.31] },
  },
  { key: K.distNorth, roles: ['ProductDistribution'], name: ls('Küstenwerk Verkaufspreise', 'Küstenwerk retail prices') },
  { key: K.distSouth, roles: ['ProductDistribution'], name: ls('Südkamm Verkaufspreise', 'Südkamm retail prices') },
  ...BRANCHES.map((b) => ({
    key: b.key, roles: ['InventorySupply' as const, 'ProductDistribution' as const], name: ls(b.name.de, b.name.en),
    address: { country: b.country, streetName: b.street, postalCode: b.postalCode, city: b.city },
    geoLocation: { type: 'Point' as const, coordinates: [b.lng, b.lat] },
    custom: {
      type: { typeId: 'type' as const, key: CONTRACT_TYPE_KEYS.branchInfo },
      fields: { openingHours: JSON.stringify(b.hours), timezone: b.timezone, pickupMode: b.pickup, phone: b.phone, storeKey: b.store },
    },
  })),
];

// ---------- stores ----------
export interface StoreDef {
  key: string;
  name: { de: string; en: string };
  /** Native `store.countries`: informational only, nothing enforces it (Q-O03). */
  countries: ('DE' | 'US')[];
  distribution: string;
  selection: string;
  branches: string[];
  buKey: string;
  addressLine: string;
  postalCode: string;
  city: string;
  countryCode: 'DE' | 'US';
  lat: number;
  lng: number;
  logoUrl: string;
}

export const STORES: StoreDef[] = [
  {
    key: K.storeNorth, name: { de: 'Küstenwerk Autoteile', en: 'Küstenwerk Auto Parts' }, countries: ['DE'], distribution: K.distNorth, selection: K.selNorth,
    branches: BRANCHES.filter((b) => b.store === K.storeNorth).map((b) => b.key), buKey: 'mau-bu-north',
    addressLine: 'Hafenallee 12', postalCode: '21079', city: 'Hamburg', countryCode: 'DE', lat: 53.4609, lng: 9.9847, logoUrl: '',
  },
  {
    key: K.storeSouth, name: { de: 'Südkamm Autoteile', en: 'Südkamm Auto Parts' }, countries: ['DE', 'US'], distribution: K.distSouth, selection: K.selSouth,
    branches: BRANCHES.filter((b) => b.store === K.storeSouth).map((b) => b.key), buKey: 'mau-bu-south',
    addressLine: 'Teilestraße 21', postalCode: '81829', city: 'München', countryCode: 'DE', lat: 48.1315, lng: 11.6849, logoUrl: '',
  },
];

/**
 * Fields of custom type `store-settings` (one type per store, so it also carries what workstreams P and Q call
 * `malva-store`: `returnWindowDays`). Q-Q01: 30 days from delivery.
 */
export const storeSettingsFields = (s: StoreDef) => ({
  ownerBusinessUnitKey: s.buKey, currency: 'EUR', taxLabel: 'MwSt. 19 %', freeShippingThresholdCent: 15000, defaultCountry: 'DE',
  shipDaysMin: 2, shipDaysMax: 3, timezone: 'Europe/Berlin', returnWindowDays: 30,
  addressLine: s.addressLine, postalCode: s.postalCode, city: s.city, countryCode: s.countryCode, latitude: s.lat, longitude: s.lng,
  logoUrl: s.logoUrl, faviconUrl: '',
});

/** Store drafts; selections are assigned afterwards (they need ids of selections that need the stores' products). */
export function storeDrafts(): StoreDraft[] {
  const ref = (key: string) => ({ typeId: 'channel' as const, key });
  return STORES.map<StoreDraft>((s) => ({
    key: s.key, name: ls(s.name.de, s.name.en), languages: ['de-DE', 'en-US'], countries: s.countries.map((code) => ({ code })),
    distributionChannels: [ref(s.distribution), ...s.branches.map(ref)], supplyChannels: [ref(K.supplyMalva), ...s.branches.map(ref)],
    custom: { type: { typeId: 'type', key: CONTRACT_TYPE_KEYS.storeSettings }, fields: storeSettingsFields(s) },
  }));
}

// ---------- associate roles (reseller portal staff only; wholesale buying is out of scope, Q-V01) ----------
const BUYER = ['ViewMyOrders', 'ViewOthersOrders', 'ViewMyCarts', 'ViewOthersCarts'];
const ADMIN = [...new Set([...BUYER, 'UpdateMyOrders', 'UpdateOthersOrders', 'AddChildUnits', 'UpdateParentUnit', 'UpdateBusinessUnitDetails', 'UpdateAssociates'])];

export const ROLE_KEYS = { admin: 'mau-role-admin', buyer: 'mau-role-buyer' } as const;
export const roleDrafts: AssociateRoleDraft[] = [
  { key: ROLE_KEYS.admin, name: 'Admin', buyerAssignable: false, permissions: ADMIN },
  { key: ROLE_KEYS.buyer, name: 'Buyer', buyerAssignable: true, permissions: BUYER },
];

// ---------- business units ----------
export type RoleName = keyof typeof ROLE_KEYS;
export interface BuDef {
  key: string;
  name: string;
  type: 'Company' | 'Division';
  parent?: string;
  kind: 'malva-global' | 'malva-dach' | 'reseller' | 'branch';
  storeKey?: string;
  channelKey?: string;
  /** Company profile shown on the portal's Company page (synthetic demo values, `example`-style). */
  profile?: { legalName: string; taxId: string; accountNumber: string };
  /** customer keys with a role */
  associates: { customer: string; role: RoleName }[];
}

export const BUSINESS_UNITS: BuDef[] = [
  { key: 'mau-bu-malva', name: 'Malva Global', type: 'Company', kind: 'malva-global', associates: [{ customer: 'mau-cust-malva-admin', role: 'admin' }] },
  { key: 'mau-bu-malva-dach', name: 'Malva DACH', type: 'Division', parent: 'mau-bu-malva', kind: 'malva-dach', associates: [] },
  {
    key: 'mau-bu-north', name: 'Küstenwerk Autoteile', type: 'Division', parent: 'mau-bu-malva-dach', kind: 'reseller', storeKey: K.storeNorth,
    profile: { legalName: 'Küstenwerk Autoteile GmbH', taxId: 'DE000000001', accountNumber: 'MAU-N-0001' },
    associates: [{ customer: 'mau-cust-north-admin', role: 'admin' }, { customer: 'mau-cust-north-buyer', role: 'buyer' }],
  },
  {
    key: 'mau-bu-south', name: 'Südkamm Autoteile', type: 'Division', parent: 'mau-bu-malva-dach', kind: 'reseller', storeKey: K.storeSouth,
    profile: { legalName: 'Südkamm Autoteile GmbH', taxId: 'DE000000002', accountNumber: 'MAU-S-0001' },
    associates: [{ customer: 'mau-cust-south-admin', role: 'admin' }, { customer: 'mau-cust-south-buyer', role: 'buyer' }],
  },
  ...BRANCHES.map<BuDef>((b) => ({
    key: `mau-bu-${b.key.replace('mau-br-', '')}`, name: b.name.en, type: 'Division', parent: b.store === K.storeNorth ? 'mau-bu-north' : 'mau-bu-south', kind: 'branch',
    storeKey: b.store, channelKey: b.key, associates: [],
  })),
];

// ---------- customers ----------
/** One garage entry (custom type `malva-customer`, field `garage`, JSON `{ vehicles, activeId }`, at most 5 vehicles). The year is the shopper's own; `fitmentKey` is the year-range key. */
export interface GarageEntry { id: string; make: string; model: string; year: number; engine: string; fitmentKey: string }

export interface CustomerDef {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: 'de-DE' | 'en-US';
  /** Store binding of a shopper; associates are not store bound. */
  store?: string;
  country: 'DE' | 'US';
  garage?: GarageEntry[];
  activeId?: string;
  marketingConsent?: boolean;
  /** Portal users only (Users table). */
  jobTitle?: string;
  kind: 'shopper' | 'associate';
}

export const garageEntry = (make: string, model: string, year: number, engine: string): GarageEntry => {
  const fitmentKey = findFitmentKey(make, model, year, engine);
  if (!fitmentKey) throw new Error(`No vehicle ${make} ${model} ${year} ${engine}`);
  return { id: slugify(`${make} ${model} ${year} ${engine}`), make, model, year, engine, fitmentKey };
};
const garage = (...v: [string, string, number, string][]) => v.map(([m, mo, y, e]) => garageEntry(m, mo, y, e));
const anna = garage(['Volkswagen', 'Golf', 2016, '2.0 TDI'], ['Audi', 'A3', 2018, '1.4 TFSI']);
const jonas = garage(['Opel', 'Astra', 2019, '1.4 Turbo']);
const mia = garage(['BMW', '3 Series', 2017, '320d']);
const liam = garage(['Ford', 'F-150', 2018, '5.0 V8'], ['Toyota', 'Camry', 2020, '2.5']);

export const CUSTOMERS: CustomerDef[] = [
  { key: 'mau-cust-anna-schneider', email: 'anna.schneider@example.com', firstName: 'Anna', lastName: 'Schneider', locale: 'de-DE', store: K.storeNorth, country: 'DE', garage: anna, activeId: anna[0]?.id, marketingConsent: true, kind: 'shopper' },
  { key: 'mau-cust-jonas-weber', email: 'jonas.weber@example.com', firstName: 'Jonas', lastName: 'Weber', locale: 'de-DE', store: K.storeNorth, country: 'DE', garage: jonas, activeId: jonas[0]?.id, marketingConsent: false, kind: 'shopper' },
  { key: 'mau-cust-mia-fischer', email: 'mia.fischer@example.com', firstName: 'Mia', lastName: 'Fischer', locale: 'de-DE', store: K.storeSouth, country: 'DE', garage: mia, activeId: mia[0]?.id, marketingConsent: false, kind: 'shopper' },
  { key: 'mau-cust-liam-carter', email: 'liam.carter@example.com', firstName: 'Liam', lastName: 'Carter', locale: 'en-US', store: K.storeSouth, country: 'US', garage: liam, activeId: liam[0]?.id, marketingConsent: true, kind: 'shopper' },
  { key: 'mau-cust-malva-admin', email: 'malva.admin@example.com', firstName: 'Malva', lastName: 'Admin', locale: 'en-US', country: 'DE', jobTitle: 'Platform administrator', kind: 'associate' },
  { key: 'mau-cust-north-admin', email: 'north.admin@example.com', firstName: 'Nora', lastName: 'Admin', locale: 'de-DE', country: 'DE', jobTitle: 'Store manager', kind: 'associate' },
  { key: 'mau-cust-north-buyer', email: 'north.buyer@example.com', firstName: 'Ben', lastName: 'Buyer', locale: 'de-DE', country: 'DE', jobTitle: 'Purchasing clerk', kind: 'associate' },
  { key: 'mau-cust-south-admin', email: 'south.admin@example.com', firstName: 'Sven', lastName: 'Admin', locale: 'de-DE', country: 'DE', jobTitle: 'Store manager', kind: 'associate' },
  { key: 'mau-cust-south-buyer', email: 'south.buyer@example.com', firstName: 'Bea', lastName: 'Buyer', locale: 'en-US', country: 'DE', jobTitle: 'Purchasing clerk', kind: 'associate' },
];
