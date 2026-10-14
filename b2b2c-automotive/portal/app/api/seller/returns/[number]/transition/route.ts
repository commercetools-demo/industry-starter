/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/returns/[number]/transition { storeKey, to, refundCents?, reason? } (V-12, V-13). `to` is a status word only: the native
// shipment and payment states are derived on the server. `to: 'refunded'` requests the refund through Checkout; the return becomes
// Refunded once the connector confirms (the portal never marks a refund successful itself).
import { z } from 'zod';
import { RETURN_STATUSES } from '@/lib/contracts/return-item';
import { transitionReturn } from '@/lib/ct/seller/returns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle, StoreKey } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

const Body = z
  .object({
    storeKey: StoreKey,
    to: z.enum(RETURN_STATUSES),
    refundCents: z.number().int().positive().max(100_000_000).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const POST = sellerHandle(async (request: Request, context: Params<'number'>) => {
  const body = await authorizedBody(request, Body, 'returns.process');
  return json(await transitionReturn(body.storeKey, await pathParam(context, 'number'), body.to, { refundCents: body.refundCents, reason: body.reason }));
});
