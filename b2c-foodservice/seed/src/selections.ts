// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api } from './api';
import type { Runner } from './lib';

/**
 * Adds products to an `Individual` product selection, idempotently: reads the ids already assigned and adds only the
 * missing ones (the API refuses a duplicate assignment). Products that do not exist yet are skipped with a note, and a
 * missing selection is reported the same way, so a partial run never fails half-way. Returns the number of products added.
 */
export async function ensureSelectionMembership(
  api: Api, run: Runner, selectionKey: string, productKeys: string[], pause: () => Promise<void> = () => Promise.resolve(),
): Promise<number> {
  const selection = await api.getByKey('product-selections', selectionKey);
  if (!selection) {
    run.note(`product selection ${selectionKey} does not exist yet: skipped (run the product-selections step)`);
    return 0;
  }
  const assigned = new Set(await api.selectionProductIds(selection.id));
  let added = 0;
  let current = selection;
  for (const key of productKeys) {
    const product = await api.getByKey('products', key);
    if (!product) { run.note(`product ${key} does not exist yet: not added to ${selectionKey}`); continue; }
    if (assigned.has(product.id)) continue;
    const updated = await run.act(`add product ${key} to ${selectionKey}`, () =>
      api.update('product-selections', current, [{ action: 'addProduct', product: { typeId: 'product', id: product.id } }]));
    if (updated) current = updated;
    added += 1;
    await pause();
  }
  return added;
}
