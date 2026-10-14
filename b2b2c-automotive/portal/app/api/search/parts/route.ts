/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// GET /api/search/parts?q=: store scoped part search for the top bar and the palette (R-13). Fewer than two characters
// answer an empty list without calling commercetools.
import { MIN_QUERY } from '@/lib/portal/search';
import { ApiError, handle, json, requireCustomer } from '@/lib/portal/route-kit';
import { getPorts, readSession } from '@/lib/portal/seam';

export const GET = handle(async (request: Request) => {
  const session = await readSession();
  requireCustomer(session);
  if (!session.storeKey || session.pending) throw new ApiError(400, 'No store selected');
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < MIN_QUERY) return json({ parts: [] });
  return json({ parts: await getPorts().searchParts(session.storeKey, q) });
});
