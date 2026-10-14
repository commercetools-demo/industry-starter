/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/bundles/[key]/publish { storeKey } : re-checks the components and the price, publishes and puts the bundle in the
// store's selection (W-09). A bundle of another store is 404.
import { publishBundle } from '@/lib/ct/seller/bundles';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';
import { StoreOnlyBody } from '@/lib/portal/w-schemas';

export const POST = sellerHandle(async (request: Request, context: Params<'key'>) => {
  const body = await authorizedBody(request, StoreOnlyBody, 'bundles.manage');
  return json(await publishBundle(body.storeKey, await pathParam(context, 'key')));
});
