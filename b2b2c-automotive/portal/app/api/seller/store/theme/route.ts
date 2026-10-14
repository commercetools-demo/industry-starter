/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// DELETE /api/seller/store/theme?storeKey= (workstream U-06, decision 14): "Reset to Malva default" deletes the store's theme in
// Contentools (server JWT) so the `default` namespace applies after the storefront cache window. An upstream 404 is success.
import { deleteStoreTheme } from '@/lib/contentools/service';
import { json } from '@/lib/portal/route-kit';
import { authorizeQuery, storeHandle } from '@/lib/portal/store-route';

export const DELETE = storeHandle(async (request: Request) => {
  const { storeKey } = await authorizeQuery(request, 'store.edit');
  await deleteStoreTheme(storeKey);
  return json({ status: 'reset' });
});
