/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Assortment writes (T-03): assign, withdraw and reconcile by changing the store's own product selection, and record the
// withdrawn state in the custom object `mau-assortment/<storeKey>` (only its `withdrawnByReseller` array). "Never widen" is
// enforced here, on the server: commercetools does not enforce it (Q-T05). The portal never writes the master selection.
import 'server-only';
import { CatalogError } from '@/lib/catalog/errors';
import { ASSORTMENT_CONTAINER, clearCatalogCaches, hydrateByIds, readAssortmentObject, type AssortmentObject } from './catalog-data';
import { catalogRoot } from './catalog-root';
import { assortmentImpact } from './assortment';
import { DEFAULT_WITHDRAW_REASON, isOwnItem, loadMembers, type Members } from './assortment-members';
import { chunk, retryOnConflict } from './versioned';

/** Hooks W (bundles) registers to reconcile its bundles after an assortment change. Called with the store key. */
export const onAssortmentChanged: Array<(storeKey: string) => Promise<void>> = [];

async function notifyChanged(storeKey: string): Promise<void> {
  for (const hook of onAssortmentChanged) await hook(storeKey);
}

/** addProduct and removeProduct in chunks of 100 actions; every chunk re-reads the selection and sends the latest version. */
async function updateSelection(selectionKey: string, actions: Array<{ action: 'addProduct' | 'removeProduct'; product: { typeId: 'product'; id: string } }>): Promise<void> {
  const root = await catalogRoot();
  for (const part of chunk(actions, 100)) {
    await retryOnConflict(async () => {
      const selection = (await root.productSelections().withKey({ key: selectionKey }).get().execute()).body;
      await root.productSelections().withId({ ID: selection.id }).post({ body: { version: selection.version, actions: part } }).execute();
    });
  }
  clearCatalogCaches();
}

/** Reads the state object, applies `change` to its withdrawn list only, writes it back with its version (retry on conflict). */
async function updateWithdrawn(storeKey: string, change: (withdrawn: AssortmentObject['withdrawnByReseller']) => AssortmentObject['withdrawnByReseller']): Promise<void> {
  const root = await catalogRoot();
  await retryOnConflict(async () => {
    const { value, version } = await readAssortmentObject(storeKey);
    const next = { ...value, withdrawnByReseller: change(value.withdrawnByReseller) };
    await root.customObjects().post({ body: { container: ASSORTMENT_CONTAINER, key: storeKey, value: next, ...(version !== undefined ? { version } : {}) } }).execute();
  });
}

function blockedIds(members: Members, ids: readonly string[]): string[] {
  const blockedSkus = new Set(members.object.blockedUpstream.map((b) => b.sku));
  const bySku = new Map(members.rows.map((r) => [r.info.id, r]));
  return ids.filter((id) => {
    const row = bySku.get(id);
    if (!row) return true; // unknown to this store: not assignable
    if (members.masterIds.has(id)) return blockedSkus.has(row.info.sku);
    // Not in the master pool: only the store's own approved item may be assigned.
    return !(isOwnItem(row.info, members.store.key) && (row.info.reviewState === undefined || row.info.reviewState === 'approved'));
  });
}

/** Assigns or reinstates products. 409 `BLOCKED_UPSTREAM` (and nothing written) when any id is blocked or outside the master pool. */
export async function assignProducts(storeKey: string, productIds: readonly string[]): Promise<{ added: number }> {
  const ids = [...new Set(productIds)];
  const members = await loadMembers(storeKey);
  // A product the store has never heard of (not in the master pool, its selection or its state object) may still be its own
  // approved item: look it up so the owner check can decide.
  const known = new Set(members.rows.map((r) => r.info.id));
  const unknown = ids.filter((id) => !known.has(id));
  const extra = unknown.length ? await hydrateByIds(unknown) : new Map();
  const view: Members = { ...members, rows: [...members.rows, ...[...extra.values()].map((info) => ({ info, membership: { inMaster: false, blockedUpstream: false, inReseller: false, withdrawnByReseller: false, preRelease: false, pendingReview: false }, state: 'available' as const, reason: '' }))] };
  const refused = blockedIds(view, ids);
  if (refused.length) throw new CatalogError(409, 'BLOCKED_UPSTREAM', 'This part is blocked upstream or not part of the Malva catalog', { productIds: refused });

  const toAdd = ids.filter((id) => !members.resellerIds.has(id));
  if (toAdd.length) await updateSelection(members.store.selection.key, toAdd.map((id) => ({ action: 'addProduct' as const, product: { typeId: 'product' as const, id } })));
  const skus = new Set(view.rows.filter((r) => ids.includes(r.info.id)).map((r) => r.info.sku));
  if (members.object.withdrawnByReseller.some((w) => skus.has(w.sku))) await updateWithdrawn(storeKey, (list) => list.filter((w) => !skus.has(w.sku)));
  if (toAdd.length) await notifyChanged(storeKey);
  return { added: toAdd.length };
}

/** Withdraws products from the store. Needs `confirm: true` and the exact count, else 409 `CONFIRMATION_REQUIRED` with the impact. */
export async function withdrawProducts(storeKey: string, productIds: readonly string[], c: { confirm: boolean; expectedCount: number }): Promise<{ removed: number }> {
  const ids = [...new Set(productIds)];
  const impact = await assortmentImpact(storeKey, ids);
  if (c.confirm !== true || c.expectedCount !== impact.count) throw new CatalogError(409, 'CONFIRMATION_REQUIRED', 'Confirm the number of products to withdraw', { ...impact });

  const members = await loadMembers(storeKey);
  const inSelection = members.rows.filter((r) => ids.includes(r.info.id) && members.resellerIds.has(r.info.id));
  if (inSelection.length) {
    await updateSelection(members.store.selection.key, inSelection.map((r) => ({ action: 'removeProduct' as const, product: { typeId: 'product' as const, id: r.info.id } })));
    const skus = new Set(inSelection.map((r) => r.info.sku));
    await updateWithdrawn(storeKey, (list) => [...list.filter((w) => !skus.has(w.sku)), ...[...skus].map((sku) => ({ sku, reason: DEFAULT_WITHDRAW_REASON }))]);
    await notifyChanged(storeKey);
  }
  return { removed: inSelection.length };
}

/** Removes from the store's selection every part that is blocked upstream or no longer in the master pool (and is not the store's own item). */
export async function reconcileAssortment(storeKey: string): Promise<{ removed: string[] }> {
  const members = await loadMembers(storeKey);
  const blocked = new Set(members.object.blockedUpstream.map((b) => b.sku));
  const stale = members.rows.filter((r) => members.resellerIds.has(r.info.id) && (blocked.has(r.info.sku) || (!members.masterIds.has(r.info.id) && !isOwnItem(r.info, storeKey))));
  if (stale.length === 0) return { removed: [] };
  await updateSelection(members.store.selection.key, stale.map((r) => ({ action: 'removeProduct' as const, product: { typeId: 'product' as const, id: r.info.id } })));
  await notifyChanged(storeKey);
  return { removed: stale.map((r) => r.info.sku) };
}

// W: registers the bundle reconciliation hook (hides and restores the store's bundles after an assortment change).
void import('./bundles-hook').catch(() => undefined);
