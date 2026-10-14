/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/tailoring?storeKey=&text=&offset=&limit= : the store's parts with the Tailored and Images chips (T-07).
import { listTailoring } from '@/lib/ct/seller/tailoring';
import { json } from '@/lib/portal/route-kit';
import { authorizeSeller, intParam, sellerHandle, storeKeyParam, textParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'catalog.view');
  return json(await listTailoring(storeKey, { text: textParam(request, 'text'), offset: intParam(request, 'offset', 0, 100_000), limit: intParam(request, 'limit', 50, 200) }));
});
