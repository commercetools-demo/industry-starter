/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/returns?storeKey=&tab=open|closed : the store's returns with KPIs (V-13); pending refunds are reconciled with the
// Payment on the way. POST { storeKey, orderNumber, items, reason, comment } records a return ("Record a return", V-11).
import { z } from 'zod';
import { RETURN_REASONS } from '@/lib/contracts/return-item';
import { createReturn, listReturns } from '@/lib/ct/seller/returns';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, authorizeSeller, sellerHandle, StoreKey, storeKeyParam } from '@/lib/portal/seller-route';
import { localeParam } from '@/lib/portal/v-route';

const Body = z
  .object({
    storeKey: StoreKey,
    orderNumber: z.string().trim().min(1).max(100),
    items: z.array(z.object({ lineItemId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(10_000) }).strict()).min(1).max(100),
    reason: z.enum(RETURN_REASONS),
    comment: z.string().trim().max(500).optional(),
  })
  .strict();

export const GET = sellerHandle(async (request: Request) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'returns.view');
  const tab = new URL(request.url).searchParams.get('tab') === 'closed' ? 'closed' : 'open';
  return json(await listReturns(storeKey, tab, localeParam(request)));
});

export const POST = sellerHandle(async (request: Request) => {
  const body = await authorizedBody(request, Body, 'returns.process');
  return json(await createReturn(body.storeKey, { orderNumber: body.orderNumber, items: body.items, reason: body.reason, comment: body.comment }), { status: 201 });
});
