/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/email/campaigns/[id]/ready { storeKey } : stores the recipient count and sets Ready. Sends nothing, persists no list.
import { markReady } from '@/lib/ct/seller/email-campaigns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';
import { StoreOnlyBody } from '@/lib/portal/w-schemas';

export const POST = sellerHandle(async (request: Request, context: Params<'id'>) => {
  const body = await authorizedBody(request, StoreOnlyBody, 'email.manage');
  return json(await markReady(body.storeKey, await pathParam(context, 'id')));
});
