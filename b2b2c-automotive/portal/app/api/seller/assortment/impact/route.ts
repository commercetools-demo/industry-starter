/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/assortment/impact { storeKey, productIds } : counts for the withdraw confirmation (T-03). Changes nothing.
import { ImpactBody } from '@/lib/catalog/route-schemas';
import { assortmentImpact } from '@/lib/ct/seller/assortment';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, ImpactBody, 'catalog.edit');
  return json(await assortmentImpact(body.storeKey, body.productIds));
});
