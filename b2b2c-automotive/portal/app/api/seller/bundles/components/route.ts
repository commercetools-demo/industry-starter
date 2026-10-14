/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/bundles/components?storeKey=&text= : the store's assigned parts with their retail price, for the component picker (W-10).
import { listComponentOptions } from '@/lib/ct/seller/bundles';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam, textParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'bundles.manage');
  return json({ components: await listComponentOptions(storeKey, textParam(request, 'text')) });
});
