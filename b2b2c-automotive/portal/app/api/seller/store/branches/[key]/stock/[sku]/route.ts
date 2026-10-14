/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// PUT /api/seller/store/branches/[key]/stock/[sku] { storeKey, availableQuantity?, priceCent? | null } (workstream U-05, Q-005,
// Q-003): sets the stock of a part on a branch and/or its branch price (null clears it). The price is written by workstream T's
// single price writer; the SKU must be in the store's assortment (422); there is no price floor.
import { setBranchStock } from '@/lib/ct/seller/branch-stock';
import { json } from '@/lib/portal/route-kit';
import { authorizeBody, storeHandle } from '@/lib/portal/store-route';
import { stockInput } from '@/lib/store/schemas';

export const PUT = storeHandle(async (request: Request, context: { params: Promise<{ key: string; sku: string }> }) => {
  const { storeKey, body } = await authorizeBody(request, 'store.edit', stockInput);
  const { key, sku } = await context.params;
  return json({ row: await setBranchStock(storeKey, key, decodeURIComponent(sku), { availableQuantity: body.availableQuantity, priceCent: body.priceCent }) });
});
