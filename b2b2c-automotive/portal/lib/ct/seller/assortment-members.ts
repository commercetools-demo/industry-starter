/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Membership of master parts in a store's assortment, from the three seed sources: the master selection
// (`mau-sel-malva-master`), the store's own selection and the state object `mau-assortment/<storeKey>`. No price access.
import 'server-only';
import { deriveState, type AssortmentState, type Membership } from '@/lib/catalog/assortment-state';
import {
  ASSORTMENT_ROW_CAP,
  MASTER_SELECTION_KEY,
  hydrateByIds,
  hydrateBySkus,
  readAssortmentObject,
  selectionProductIds,
  type AssortmentObject,
  type ProductInfo,
} from './catalog-data';
import { getSellerStore, type SellerStore } from './store-info';

export interface MemberRow {
  info: ProductInfo;
  membership: Membership;
  state: AssortmentState;
  reason: string;
  reasonBy?: string;
}

export interface Members {
  store: SellerStore;
  object: AssortmentObject;
  objectVersion?: number;
  masterIds: Set<string>;
  resellerIds: Set<string>;
  rows: MemberRow[];
  capped: boolean;
}

/** An item the store owns itself: a local part (approved) or an own bundle, recognised by the attribute, never by key prefix. */
export function isOwnItem(info: ProductInfo, storeKey: string): boolean {
  return info.ownerStore === storeKey;
}

export const DEFAULT_WITHDRAW_REASON = 'Withdrawn by you';

export async function loadMembers(storeKey: string): Promise<Members> {
  const [store, objectRead] = await Promise.all([getSellerStore(storeKey), readAssortmentObject(storeKey)]);
  const object = objectRead.value;
  const [masterIds, resellerIds] = await Promise.all([selectionProductIds(MASTER_SELECTION_KEY), selectionProductIds(store.selection.key)]);

  const baseIds = [...new Set([...masterIds, ...resellerIds])];
  const capped = baseIds.length > ASSORTMENT_ROW_CAP;
  const infos = await hydrateByIds(capped ? baseIds.slice(0, ASSORTMENT_ROW_CAP) : baseIds);
  const bySku = new Map<string, ProductInfo>([...infos.values()].map((i) => [i.sku, i]));

  // Parts only named in the state object (withdrawn or awaiting review local parts) are looked up by SKU.
  const missing = [...new Set([...object.withdrawnByReseller.map((w) => w.sku), ...object.pendingReview])].filter((sku) => !bySku.has(sku));
  for (const [sku, info] of await hydrateBySkus(missing)) {
    // Another store's local part never enters this store's list.
    if (info.ownerStore && info.ownerStore !== storeKey) continue;
    bySku.set(sku, info);
    infos.set(info.id, info);
  }

  const blocked = new Map(object.blockedUpstream.map((b) => [b.sku, b]));
  const withdrawn = new Map(object.withdrawnByReseller.map((w) => [w.sku, w]));
  const preRelease = new Set(object.preRelease);
  const pending = new Set(object.pendingReview);

  const rows: MemberRow[] = [];
  for (const info of [...bySku.values()].sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))) {
    const inMaster = masterIds.has(info.id);
    const inReseller = resellerIds.has(info.id);
    // A foreign local part (owned by another store) that is in neither this selection nor named here is not a row.
    if (!inMaster && !inReseller && !withdrawn.has(info.sku) && !pending.has(info.sku)) continue;
    const membership: Membership = {
      inMaster,
      blockedUpstream: blocked.has(info.sku),
      inReseller,
      withdrawnByReseller: withdrawn.has(info.sku),
      preRelease: preRelease.has(info.sku),
      pendingReview: pending.has(info.sku),
    };
    const state = deriveState(membership);
    const block = blocked.get(info.sku);
    const reason = state === 'blocked-upstream' ? (block?.reason ?? '') : state === 'withdrawn' ? (withdrawn.get(info.sku)?.reason ?? DEFAULT_WITHDRAW_REASON) : '';
    rows.push({ info, membership, state, reason, ...(state === 'blocked-upstream' && block?.by ? { reasonBy: block.by } : {}) });
  }
  return { store, object, objectVersion: objectRead.version, masterIds, resellerIds, rows, capped };
}

/** Assigned parts of the store by SKU (the store's selection members). */
export async function assignedBySku(storeKey: string): Promise<Map<string, ProductInfo>> {
  const members = await loadMembers(storeKey);
  return new Map(members.rows.filter((r) => members.resellerIds.has(r.info.id)).map((r) => [r.info.sku, r.info]));
}
