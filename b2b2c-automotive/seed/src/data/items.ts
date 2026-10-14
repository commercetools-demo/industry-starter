// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { K } from './base';
import { PARTS, partKey } from './parts';

/** Bundles: one product that lists its components (design-bundles-and-product-import). `owner` empty = Malva master. */
export interface BundleDef {
  sku: string;
  de: string;
  en: string;
  cat: string;
  components: { sku: string; qty: number }[];
  discountPercent: number;
  owner?: string;
}

/** Reseller-owned local part: no fitment, visible to the owner's branches only. */
export interface LocalPartDef {
  sku: string;
  de: string;
  en: string;
  cat: string;
  owner: string;
  brandName: string;
  eur: number;
  review: 'approved' | 'pending' | 'rejected';
  recurring?: boolean;
}

export const LOCAL_PARTS: LocalPartDef[] = [
  { sku: 'KW-1001', de: 'Küstenwerk Bremsenreiniger, 500 ml', en: 'Küstenwerk brake cleaner, 500 ml', cat: 'brakes/calipers', owner: K.storeNorth, brandName: 'Küstenwerk', eur: 790, review: 'approved' },
  { sku: 'KW-1002', de: 'Küstenwerk Felgenreiniger, 1 l', en: 'Küstenwerk wheel cleaner, 1 l', cat: 'care/coolant', owner: K.storeNorth, brandName: 'Küstenwerk', eur: 1090, review: 'approved' },
  { sku: 'SK-2001', de: 'Südkamm Frostschutz-Scheibenwasser, 5 l', en: 'Südkamm winter screen wash, 5 l', cat: 'care/coolant', owner: K.storeSouth, brandName: 'Südkamm', eur: 890, review: 'approved', recurring: true },
  // Pending review: kept out of every selection until Malva approves it.
  { sku: 'SK-2002', de: 'Südkamm Dachträger-Set', en: 'Südkamm roof rack set', cat: 'care/wipers', owner: K.storeSouth, brandName: 'Südkamm', eur: 12900, review: 'pending' },
];

export const BUNDLES: BundleDef[] = [
  {
    sku: 'MLV-KIT-71001', de: 'Bremsen-Service-Set vorn', en: 'Front brake service kit', cat: 'brakes/pads', discountPercent: 10,
    components: [{ sku: 'MLV-BP-41001', qty: 1 }, { sku: 'MLV-BD-42001', qty: 2 }, { sku: 'MLV-BC-43002', qty: 1 }],
  },
  {
    sku: 'MLV-KIT-71002', de: 'Inspektions-Set Diesel', en: 'Diesel service kit', cat: 'filters/oil', discountPercent: 8,
    components: [{ sku: 'MLV-OF-44002', qty: 1 }, { sku: 'MLV-AF-45001', qty: 1 }, { sku: 'MLV-CF-46001', qty: 1 }, { sku: 'MLV-FF-47001', qty: 1 }],
  },
  {
    sku: 'KW-KIT-1101', de: 'Küstenwerk Brems-Komplettpaket', en: 'Küstenwerk complete brake package', cat: 'brakes/pads', discountPercent: 10, owner: K.storeNorth,
    components: [{ sku: 'MLV-BP-41001', qty: 1 }, { sku: 'MLV-BD-42001', qty: 2 }, { sku: 'KW-1001', qty: 1 }],
  },
];

/** Product key of any seeded item by SKU. */
export function keyOfSku(sku: string): string {
  if (BUNDLES.some((b) => b.sku === sku)) return `mau-bundle-${sku.toLowerCase()}`;
  if (LOCAL_PARTS.some((l) => l.sku === sku)) return `mau-local-${sku.toLowerCase()}`;
  return partKey(sku);
}

/** List price in EUR cents of any seeded item by SKU (master part or local part). */
export function eurOf(sku: string): number {
  const p = PARTS.find((x) => x.sku === sku);
  if (p) {
    if (p.eur === null) throw new Error(`${sku} has no price`);
    return p.eur;
  }
  const l = LOCAL_PARTS.find((x) => x.sku === sku);
  if (l) return l.eur;
  throw new Error(`Unknown SKU ${sku}`);
}

/** Bundle list price: components total minus the bundle discount, rounded to 10 cents. */
export function bundleEur(b: BundleDef): number {
  const total = b.components.reduce((s, c) => s + eurOf(c.sku) * c.qty, 0);
  return Math.round((total * (100 - b.discountPercent)) / 100 / 10) * 10;
}
