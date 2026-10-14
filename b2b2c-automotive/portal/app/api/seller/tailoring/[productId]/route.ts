/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/seller/tailoring/[productId]?storeKey= : master and tailored values side by side (T-07).
// PUT /api/seller/tailoring/[productId] { storeKey, name?, description?, images? } : saves and PUBLISHES in the same request (no review).
// The body is strict: only name, description and images can be tailored; SKU, fitment, specs and slug are refused.
import { TailoringInput } from '@/lib/catalog/tailoring-schema';
import { getTailoringDetail, saveTailoring } from '@/lib/ct/seller/tailoring';
import { json } from '@/lib/portal/route-kit';
import { readSession } from '@/lib/portal/seam';
import { authorizedBody, authorizeSeller, sellerHandle, storeKeyParam } from '@/lib/portal/seller-route';

type Context = { params: Promise<{ productId: string }> };

export const GET = sellerHandle(async (request: Request, { params }: Context) => {
  const storeKey = storeKeyParam(request);
  await authorizeSeller(storeKey, 'catalog.view');
  return json(await getTailoringDetail(storeKey, (await params).productId));
});

export const PUT = sellerHandle(async (request: Request, { params }: Context) => {
  const body = await authorizedBody(request, TailoringInput, 'tailoring.edit');
  const { storeKey, ...fields } = body;
  return json(await saveTailoring(storeKey, (await params).productId, fields, (await readSession()).customerId ?? ''));
});
