/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/orders/[number]/delivered { storeKey } : the Admin action "Mark delivered" (V-05, D9). Sets `custom.deliveredAt` of the
// order once (a second call keeps the first date); the 30 day return window runs from it. The order is read in-store (another store's
// order is a 404).
import { z } from 'zod';
import { markDelivered } from '@/lib/ct/seller/returns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle, StoreKey } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

const Body = z.object({ storeKey: StoreKey }).strict();

export const POST = sellerHandle(async (request: Request, context: Params<'number'>) => {
  const body = await authorizedBody(request, Body, 'customers.manage');
  const number = await pathParam(context, 'number');
  return json(await markDelivered(body.storeKey, number));
});
