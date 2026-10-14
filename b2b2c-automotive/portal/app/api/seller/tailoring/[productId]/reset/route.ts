/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/tailoring/[productId]/reset { storeKey } : deletes the store's tailoring; master text and images show again (T-07).
import { z } from 'zod';
import { resetTailoring } from '@/lib/ct/seller/tailoring';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle } from '@/lib/portal/seller-route';

const Body = z.object({ storeKey: z.string().min(1).max(256) }).strict();

export const POST = sellerHandle(async (request: Request, { params }: { params: Promise<{ productId: string }> }) => {
  const body = await authorizedBody(request, Body, 'tailoring.edit');
  await resetTailoring(body.storeKey, (await params).productId);
  return json({ reset: true });
});
