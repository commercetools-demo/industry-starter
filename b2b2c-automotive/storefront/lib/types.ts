// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// App types: the boundary between commercetools and components. Components import from here, never from lib/ct or the SDK.
import type { AppLocale } from '@/i18n/config';

export type LocalizedString = Record<string, string>;

export interface Money {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
}

/**
 * The session payload (ids only, no personal data). Later workstreams extend this interface and `SESSION_KEYS`
 * in `lib/session-core.ts` in the same commit.
 */
export interface Session {
  customerId?: string;
  cartId?: string;
  locale?: AppLocale;
  currency?: string;
  country?: string;
  storeKey?: string;
  distributionChannelId?: string;
  supplyChannelId?: string;
  productSelectionId?: string;
  /** The branch (channel key) the shopper chose; read through `getBranchScope`, cleared with `cartId` on a store change (workstream I). */
  branchKey?: string;
}

/** The four store fields, always written to the session together. */
export interface StoreContext {
  storeKey: string;
  distributionChannelId: string;
  supplyChannelId: string;
  productSelectionId: string;
}

export interface ChannelRef {
  id: string;
  key: string;
}

export interface StoreSummary extends StoreContext {
  key: string;
  /** Display name in the default locale; callers pick another locale from `nameLocalized`. */
  name: string;
  nameLocalized: LocalizedString;
  /** `store.countries`: informational only, nothing enforces it (Q-O03). Stores carry no currencies in commercetools. */
  countries: string[];
  /** All of the store's channels sorted by key; the default pair in `StoreContext` is the first of each. */
  distributionChannels: ChannelRef[];
  supplyChannels: ChannelRef[];
}

// ---- Shell and store picker (workstream I) ----

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type OpeningHours = Partial<Record<Weekday, [string, string]>>;
export type PickupMode = 'same-day' | 'next-day' | 'ship-to-store';

/** Store identity and commercial promises from the `store-settings` custom type. */
export interface StoreSettings {
  name: string;
  logoUrl?: string;
  faviconUrl?: string;
  freeShippingThresholdCent?: number;
  /** Currency of `freeShippingThresholdCent`; the utility bar states the threshold only on a page of that currency. */
  currency?: string;
  shipDays: { min: number; max: number };
  /** IANA zone of the reseller. */
  timezone: string;
  helpUrl?: string;
  trackUrl?: string;
}

/** A pickup branch: a channel with the `branch-info` custom type. It carries stock and, optionally, prices. */
export interface Branch {
  key: string;
  channelId: string;
  name: string;
  address: { street: string; postalCode: string; city: string };
  geo?: { lat: number; lng: number };
  hours: OpeningHours;
  /** IANA zone of the opening hours; wins over the store timezone. */
  timezone: string;
  pickupMode: PickupMode;
  phone?: string;
}

export type PickupOption = 'today' | 'tomorrow' | 'ship-to-store';
export type HoursState = { open: true; closesAt: string } | { open: false; opensAt: string | null; opensToday: boolean };

/** What the shell needs from a store: ids, settings and branches. */
export interface ShellContext {
  storeId: string;
  settings: StoreSettings;
  /** Branches sorted by key. */
  branches: Branch[];
  /** The store's distribution channel without `branch-info` (the reseller's retail prices). */
  retailChannelId?: string;
  /** `store.countries`, used to limit geocoding. */
  countries: string[];
}

export interface BranchView extends Branch {
  hoursState: HoursState;
  pickup: PickupOption;
}

export interface BranchesResponse {
  single: boolean;
  selectedKey: string;
  /** True when the shopper chose `selectedKey` (the session holds a valid `branchKey`). */
  chosen: boolean;
  branches: BranchView[];
}

export interface NavCategory {
  id: string;
  slug: string;
  name: string;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

// ---- Vehicle finder and garage (workstream J) ----

/** `{make}.{model}.{year}.{engine}`, each part a lowercase slug (`volkswagen.golf.2016.2-0-tdi`). Identifies a vehicle the shopper owns (one year). */
export type VehicleId = string;
export interface Vehicle {
  id: VehicleId;
  make: string;
  model: string;
  year: number;
  engine: string;
  /** "2016 Volkswagen Golf · 2.0 TDI" */
  label: string;
}
/** One garage entry; the seed's `malva-customer.garage` JSON verbatim, plus the optional storefront-only nickname (max 40 characters). */
export interface GarageVehicle {
  id: VehicleId;
  make: string;
  model: string;
  year: number;
  engine: string;
  fitmentKey: string;
  nickname?: string;
}
/** At most 5 vehicles, newest last. */
export interface Garage {
  vehicles: GarageVehicle[];
  activeId: VehicleId | null;
}
/** Inclusive years. */
export interface FitmentRange {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
}
/** The part side of fit: the mapped product's range keys and universal flag. */
export interface FitmentProduct {
  fitmentKeys: string[];
  universalFit: boolean;
}
/** One record of the vehicle table (custom object container `mau-vehicles`). */
export interface VehicleRecord {
  make: string;
  model: string;
  generation: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
  markets: string[];
  fitmentKey: string;
}
/** What `GET /api/garage` and every garage mutation return. `vehicles` follows `garage.vehicles`; `active` is the active one. */
export interface GarageState {
  garage: Garage;
  vehicles: Vehicle[];
  active: Vehicle | null;
}
