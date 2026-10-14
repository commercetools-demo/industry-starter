/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/discounts?storeKey=&kind=product|cart : the store's own discounts, ranked, plus the Malva-funded ones (locked).
import { DiscountKindParam } from '@/lib/catalog/route-schemas';
import { listDiscounts } from '@/lib/ct/seller/discounts';
import { ApiError, json } from '@/lib/portal/route-kit';
import { authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'catalog.view');
  const kind = DiscountKindParam.safeParse(new URL(request.url).searchParams.get('kind'));
  if (!kind.success) throw new ApiError(400, 'kind must be product or cart');
  return json({ discounts: await listDiscounts(storeKey, kind.data) });
});
