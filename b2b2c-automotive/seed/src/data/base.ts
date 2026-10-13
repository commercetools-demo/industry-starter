// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/** Languages the seed writes names in (design decision K: de-DE and en-US only). */
export const LANGUAGES = ['de-DE', 'en-US'] as const;
export const COUNTRIES = ['DE', 'US', 'GB'] as const;
export const CURRENCIES = ['EUR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type LString = Record<string, string>;
export const ls = (de: string, en: string): LString => ({ 'de-DE': de, 'en-US': en });

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every key the seed owns. */
export const K = {
  // taxes, zones, shipping
  taxParts: 'mau-tax-parts',
  zoneDe: 'mau-zone-de', zoneUs: 'mau-zone-us',
  shipStandard: 'mau-ship-standard', shipExpress: 'mau-ship-express', shipPickup: 'mau-ship-pickup',
  // product types
  ptPart: 'mau-pt-part', ptLocalPart: 'mau-pt-local-part', ptBundle: 'mau-pt-bundle',
  // channels
  supplyMalva: 'mau-supply-malva-dc', distNorth: 'mau-dist-north', distSouth: 'mau-dist-south',
  // stores
  storeNorth: 'mau-reseller-north', storeSouth: 'mau-reseller-south',
  // selections
  selMaster: 'mau-sel-malva-master', selNorth: 'mau-sel-north', selSouth: 'mau-sel-south',
  // custom object containers
  cVehicles: 'mau-vehicles', cAssortment: 'mau-assortment', cSite: 'mau-site',
  // Malva-level (no reseller) site content; the storefront Malva home reads `home-banners` (key without the mau- prefix: contract name)
  cMalvaSite: 'malva-site',
  cConfiguration: 'configuration',
  // root category
  catRoot: 'mau-cat-parts',
} as const;

/** Every custom object container the seed OWNS completely (reset empties these). */
export const OWNED_CONTAINERS = [K.cVehicles, K.cAssortment, K.cSite, K.cMalvaSite] as const;

/**
 * Contract container the portal also writes into (workstream W, review of reseller-created local parts): the seed owns
 * only the explicit objects of `localReviewObjects()` (assortment.ts); `reset` deletes exactly those keys and never
 * lists or empties the container. Key `<storeKey>--<product key>`.
 */
export const LOCAL_REVIEW_CONTAINER = 'malva-local-review';

/**
 * Keys the other workstreams hard-code and that therefore do NOT carry the `mau-` prefix: the custom types and the order
 * state below. They are still seed-owned (explicit key lists, never a pattern); `reset` and the key test accept exactly
 * these. The apps read them by key, so renaming one means editing the plans of I, J, O, P, Q, U and W.
 */
export const CONTRACT_TYPE_KEYS = {
  storeSettings: 'store-settings', branchInfo: 'branch-info', customer: 'malva-customer', checkout: 'malva-checkout',
  line: 'malva-line', returnItem: 'malva-return-item',
} as const;
export const STATE_READY_FOR_PICKUP = 'ready-for-pickup';
export const CONTRACT_KEYS: readonly string[] = [...Object.values(CONTRACT_TYPE_KEYS), STATE_READY_FOR_PICKUP];
