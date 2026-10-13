// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/auth/demo-login` { customerId } -> `{ customer, count }` (workstream Q-13a). 404 unless demo login is enabled. The browser sends only
// the id; the store is the session's (set by the page of that store), the password stays on the server. An id outside the store's demo list is 403.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { AuthError } from '@/lib/auth/login';
import { demoSignIn, isDemoLoginEnabled } from '@/lib/demo-login';
import { getSession } from '@/lib/session';

const body = z.object({ customerId: z.string().min(1).max(64) });
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export const POST = handle(async (request: Request) => {
  if (!isDemoLoginEnabled()) throw new ApiError(404, 'Not found');
  const { customerId } = await parseJson(request, body);
  const { storeKey } = await getSession();
  if (!storeKey) throw new ApiError(404, 'Not found');
  try {
    return Response.json(await demoSignIn(customerId, storeKey), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: 'demo-login-failed' }, { status: 401, headers: NO_STORE });
    throw error;
  }
});
