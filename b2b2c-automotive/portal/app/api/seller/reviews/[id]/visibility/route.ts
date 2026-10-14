/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/seller/reviews/[id]/visibility { storeKey, visibility: 'published' | 'hidden' } : show or hide a review of this store through
// the review states (V-16). A hidden review leaves the storefront list and the rating statistics.
import { z } from 'zod';
import { setVisibility } from '@/lib/ct/seller/reviews';
import { json } from '@/lib/portal/route-kit';
import { authorizedBody, sellerHandle, StoreKey } from '@/lib/portal/seller-route';
import { pathParam, type Params } from '@/lib/portal/w-route';

const Body = z.object({ storeKey: StoreKey, visibility: z.enum(['published', 'hidden']) }).strict();

export const POST = sellerHandle(async (request: Request, context: Params<'id'>) => {
  const body = await authorizedBody(request, Body, 'reviews.moderate');
  return json(await setVisibility(body.storeKey, await pathParam(context, 'id'), body.visibility));
});
