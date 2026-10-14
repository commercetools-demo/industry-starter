// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// App types of Store & channels (workstream U-05). Pure: components import these, never lib/ct or the SDK; the server modules in
// lib/ct/seller produce them.
import type { Money } from '@/lib/types';
import type { OpeningHours, PickupMode } from './schemas';
import type { SalesChannel } from '@/lib/portal/share-links';

export interface StoreSettings {
  key: string;
  name: Record<string, string>;
  logoUrl?: string;
  faviconUrl?: string;
  location: { addressLine?: string; postalCode?: string; city?: string; countryCode?: string; latitude?: number; longitude?: number };
  /** Read-only storefront address ("Managed by Malva"). */
  address: string;
  /** Currency and country of the store, read-only ("Managed by Malva"). */
  currency?: string;
  defaultCountry?: string;
}

export interface Branch {
  key: string;
  name: Record<string, string>;
  address: { streetName: string; streetNumber?: string; postalCode: string; city: string; country: string };
  geoLocation?: { lat: number; lng: number };
  openingHours: OpeningHours;
  timezone: string;
  pickupMode: PickupMode;
  phone?: string;
}

export interface StockRow {
  sku: string;
  name: Record<string, string>;
  /** `null`: no inventory entry yet. */
  availableQuantity: number | null;
  /** `null`: no branch price, the store price applies. */
  priceCent: number | null;
}

export interface StockPage {
  rows: StockRow[];
  total: number;
  offset: number;
  limit: number;
  currency: 'EUR' | 'USD';
}

export interface ChannelRow {
  id: SalesChannel;
  label: string;
  status: 'Live' | 'Demo';
  orders: number;
  revenue: Money;
  /** Share of the Live channels' revenue in whole percent; 0 for Demo rows. */
  sharePercent: number;
  /** True when the figure rests on a default (orders without a sales channel counted as web) or is synthetic. */
  indicative: boolean;
}

export interface ChannelStats {
  rows: ChannelRow[];
  truncated: boolean;
  currency: string;
  days: number;
}
