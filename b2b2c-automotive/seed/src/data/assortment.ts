// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { K } from './base';
import { BUNDLES, LOCAL_PARTS, keyOfSku } from './items';
import { PARTS, isUsOnly, type PartDef } from './parts';

/**
 * Assortment per reseller (design-catalog-assortment). Each store gets a product selection with a different set:
 *  - north: no exhaust, no US-only parts, withdrew the economy front pad
 *  - south: no belts, no cooling, includes US parts, withdrew the diesel fuel filter (so the diesel service kit is hidden)
 *  - both: the LED fog lamp is blocked upstream (no type approval in DACH)
 * A bundle is in a selection only when all its components are.
 */
export const BLOCKED_UPSTREAM = [{ sku: 'MLV-HL-56002', by: 'Malva DACH', reason: 'No type approval for road use in Germany' }];

export const WITHDRAWN: Record<string, { sku: string; reason: string }[]> = {
  [K.storeNorth]: [{ sku: 'MLV-BP-41003', reason: 'Quality policy: premium brake parts only' }],
  [K.storeSouth]: [{ sku: 'MLV-FF-47001', reason: 'Supplied locally by the regional distributor' }],
};

const excludedBy: Record<string, (p: PartDef) => boolean> = {
  [K.storeNorth]: (p) => p.cat.startsWith('exhaust/') || isUsOnly(p),
  [K.storeSouth]: (p) => p.cat.startsWith('engine/belts') || p.cat.startsWith('cooling/'),
};

export const PRE_RELEASE_SKUS = PARTS.filter((p) => p.eur === null).map((p) => p.sku);

/** All SKUs Malva sells (priced master parts, pre-release parts, Malva bundles). */
export const masterSkus = (): string[] => [...PARTS.map((p) => p.sku), ...BUNDLES.filter((b) => !b.owner).map((b) => b.sku)];

/** SKUs in a reseller's selection (parts, local items of that reseller, bundles whose components are all available). */
export function assortmentSkus(storeKey: string): string[] {
  const out = new Set<string>();
  const blocked = new Set(BLOCKED_UPSTREAM.map((b) => b.sku));
  const withdrawn = new Set((WITHDRAWN[storeKey] ?? []).map((w) => w.sku));
  for (const p of PARTS) {
    if (p.eur === null || blocked.has(p.sku) || withdrawn.has(p.sku) || excludedBy[storeKey]?.(p)) continue;
    out.add(p.sku);
  }
  for (const l of LOCAL_PARTS) if (l.owner === storeKey && l.review === 'approved') out.add(l.sku);
  for (const b of BUNDLES) {
    if (b.owner && b.owner !== storeKey) continue;
    if (b.components.every((c) => out.has(c.sku))) out.add(b.sku);
  }
  return [...out];
}

export const assortmentKeys = (storeKey: string): string[] => assortmentSkus(storeKey).map(keyOfSku);
export const masterKeys = (): string[] => masterSkus().map(keyOfSku);

/** Custom object `mau-assortment/<storeKey>`: the states the portal shows that a selection alone cannot express. */
export function assortmentObject(storeKey: string) {
  return {
    storeKey,
    withdrawnByReseller: WITHDRAWN[storeKey] ?? [],
    blockedUpstream: BLOCKED_UPSTREAM,
    preRelease: PRE_RELEASE_SKUS,
    pendingReview: LOCAL_PARTS.filter((l) => l.owner === storeKey && l.review === 'pending').map((l) => l.sku),
  };
}
