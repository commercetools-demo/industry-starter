/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/assortment?storeKey=&state=&text=&categoryId=&offset=&limit= : rows of "Assigned products" (T-03).
import { json } from '@/lib/portal/route-kit';
import { AssortmentFilter } from '@/lib/catalog/route-schemas';
import { listAssortment } from '@/lib/ct/seller/assortment';
import { ApiError } from '@/lib/portal/route-kit';
import { authorizeSeller, intParam, sellerHandle, storeKeyParam, textParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'catalog.view');
  const params = new URL(request.url).searchParams;
  const filter = AssortmentFilter.safeParse({
    ...(params.get('state') ? { state: params.get('state') } : {}),
    ...(textParam(request, 'text') ? { text: textParam(request, 'text') } : {}),
    ...(params.get('categoryId') ? { categoryId: params.get('categoryId') } : {}),
  });
  if (!filter.success) throw new ApiError(400, filter.error.issues[0]?.message ?? 'Invalid filter');
  const page = await listAssortment(storeKey, { ...filter.data, offset: intParam(request, 'offset', 0, 100_000), limit: intParam(request, 'limit', 50, 200) });
  return json(page);
});
