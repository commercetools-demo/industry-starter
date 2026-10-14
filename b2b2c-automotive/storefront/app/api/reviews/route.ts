// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/reviews` (workstream M): the signed-in customer reviews a part bought in the session's store, once.
//   body   { productId, rating (1 to 5), title (max 80), text (max 1000) }
//   201    { id }   the review is published at once (Q-004), in the store of the session
//   401 not signed in   403 `not-purchased`   404 reviews switched off or no store   409 `already-reviewed`
// The store key, customer and author come from the session, never from the body. Client code calls it through `useSubmitReview`.
import { z } from 'zod';
import { ApiError, handle, parseJson, requireCustomer } from '@/lib/api';
import { createReview, reviewSubmissionEnabled } from '@/lib/ct/reviews';
import { getLocale, getSession } from '@/lib/session';

const body = z.object({
  productId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1, 'Title required').max(80),
  text: z.string().trim().min(1, 'Text required').max(1000),
});

export const POST = handle(async (request: Request) => {
  if (!reviewSubmissionEnabled()) throw new ApiError(404, 'Not found');
  const input = await parseJson(request, body);
  const session = await getSession();
  requireCustomer(session);
  if (!session.storeKey) throw new ApiError(404, 'Not found');
  const { locale } = await getLocale();
  const { id } = await createReview(session.storeKey, session.customerId, { ...input, locale });
  return Response.json({ id }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
});
