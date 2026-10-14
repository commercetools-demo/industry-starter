/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/campaigns/[key]/discount { storeKey } : "Create discount" (W-01). Writes an inactive cart discount and a store
// suffixed code for the session's store only. The value, dates and eligible products come from the campaign object, never from the body.
import { createCoopDiscount } from '@/lib/ct/seller/campaigns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';
import { StoreOnlyBody } from '@/lib/portal/w-schemas';

export const POST = sellerHandle(async (request: Request, context: Params<'key'>) => {
  const body = await authorizedBody(request, StoreOnlyBody, 'marketing.manage');
  const key = await pathParam(context, 'key');
  return json(await createCoopDiscount(body.storeKey, key), { status: 201 });
});
