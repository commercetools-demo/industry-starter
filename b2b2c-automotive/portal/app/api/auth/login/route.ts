/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// POST /api/auth/login: email and password sign-in (R-06). Unknown email and wrong password give one status and one body.
// Known gap (workstream X decision D9): no rate limiting or bot protection is built anywhere in this project.
import { z } from 'zod';
import { cookieValue, startSession } from '@/lib/portal/auth-session';
import { fail, handle, parseJson } from '@/lib/portal/route-kit';
import { getPorts } from '@/lib/portal/seam';

const body = z.object({ email: z.string(), password: z.string() });

export const POST = handle(async (request: Request) => {
  const { email, password } = await parseJson(request, body);
  if (!email.trim() || !password) return fail(400, 'Fill in every field to continue.', 'FIELDS_REQUIRED');
  const preferredUnitKey = cookieValue(request, 'portal_last_bu');
  const outcome = await getPorts().login(email.trim().toLowerCase(), password, preferredUnitKey ? { preferredUnitKey } : undefined);
  return startSession(outcome, request);
});
