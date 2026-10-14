/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// node scripts/reconcile-assortment.mjs <storeKey>
// Report only: compares the store's own selection with "master selection minus the store's withdrawn and blocked parts" (the
// `mau-assortment/<storeKey>` object) and lists drift. The portal's own reconcile (POST /api/seller/assortment/reconcile) does the fix.
import { connect, MASTER_SELECTION, readArgs, SEEDED_STORES, selectionIds } from './catalog-live.mjs';

const { storeKey } = readArgs(process.argv.slice(2), { usage: 'usage: reconcile-assortment.mjs <storeKey>' });
const selectionKey = SEEDED_STORES[storeKey] ?? process.env.STORE_SELECTION_KEY;
if (!selectionKey) {
  console.error('This store key is not seeded: set STORE_SELECTION_KEY to its selection key.');
  process.exit(1);
}

const ctp = await connect();
const [master, own, object] = await Promise.all([
  selectionIds(ctp, MASTER_SELECTION),
  selectionIds(ctp, selectionKey),
  ctp.api('GET', `/custom-objects/mau-assortment/${encodeURIComponent(storeKey)}`).catch(() => ({ value: {} })),
]);
const skus = [...(object.value.withdrawnByReseller ?? []), ...(object.value.blockedUpstream ?? [])].map((w) => w.sku);
const blockedIds = new Set();
for (let i = 0; i < skus.length; i += 100) {
  const part = skus.slice(i, i + 100);
  if (part.length === 0) continue;
  const q = part.map((s) => `var.skus=${encodeURIComponent(s)}`).join('&');
  const found = await ctp.api('GET', `/product-projections?staged=false&limit=100&where=${encodeURIComponent('masterVariant(sku in :skus)')}&${q}`);
  for (const p of found.results) blockedIds.add(p.id);
}
const expected = new Set([...master].filter((id) => !blockedIds.has(id)));
const missing = [...expected].filter((id) => !own.has(id));
const extra = [...own].filter((id) => master.has(id) && blockedIds.has(id));
console.log(`${storeKey}: master ${master.size}, withdrawn or blocked ${blockedIds.size}, in store selection ${own.size}`);
console.log(`missing from the store selection: ${missing.length}${missing.length ? ` (${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', ...' : ''})` : ''}`);
console.log(`still in the store selection although withdrawn or blocked: ${extra.length}`);
process.exit(missing.length + extra.length === 0 ? 0 : 2);
