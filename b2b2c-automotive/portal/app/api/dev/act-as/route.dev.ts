/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Development only (R-15, Q-R05): POST { name } sets the customer-session banner before workstream V exists.
// The `.dev.ts` extension keeps this route out of production builds (next.config.ts pageExtensions); the check below is a second guard.
import { z } from 'zod';
import { ApiError, handle, json, parseJson, requireCustomer } from '@/lib/portal/route-kit';
import { readSession, writeSession } from '@/lib/portal/seam';

const body = z.object({ name: z.string().trim().min(1).max(80) });

export const POST = handle(async (request: Request) => {
  if (process.env.NODE_ENV === 'production') throw new ApiError(404, 'Not found');
  requireCustomer(await readSession());
  const { name } = await parseJson(request, body);
  await writeSession((s) => ({ ...s, actingAs: name }));
  return json({ status: 'acting-as' });
});
