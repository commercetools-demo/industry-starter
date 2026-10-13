// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Types of the Malva level pages (change add-malva-home): the home, the whole-catalog listing and the reseller finder.
// Safe for client components: no server-only import.

/** A product card of the Malva listing. It has no price, stock or detail link field on purpose: the data never reaches the browser. */
export interface MalvaProductSummary {
  id: string;
  sku: string;
  /** Part number (`part-number` attribute); the sku when the product has none. */
  partNumber: string;
  name: string;
  /** Localized product slug of the master catalog: only used to build `/{locale}/{store}/p/{slug}` at a reseller (it is not price or stock data). */
  slug: string;
  /** The brand label; empty for products without one. */
  brand: string;
  imageUrl?: string;
  imageAlt: string;
  universalFit: boolean;
  fitmentKeys: string[];
}

export interface MalvaFacetResult {
  name: string;
  buckets: { key: string; count: number }[];
}

/** One page of the Malva listing. */
export interface MalvaListingResult {
  items: MalvaProductSummary[];
  total: number;
  page: number;
  totalPages: number;
  facets: MalvaFacetResult[];
}

/** A branch of a reseller as the finder shows it (no channel id). */
export interface ResellerBranch {
  key: string;
  name: string;
  city: string;
  lat?: number;
  lng?: number;
}

/** A reseller (a store with a distribution channel) as the finder shows it. `key` is the store key, already part of every reseller URL. */
export interface Reseller {
  key: string;
  name: string;
  city: string;
  postalCode: string;
  address: string;
  lat?: number;
  lng?: number;
  branches: ResellerBranch[];
}
