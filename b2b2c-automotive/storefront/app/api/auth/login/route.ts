// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/auth/login` { email, password } -> `{ customer, count }`: store scoped login with the anonymous cart merged, then the sign-in
// hooks (see `lib/auth/login.ts`). Every failure for bad credentials answers the same 401 `{ error: 'invalid-credentials' }`; ten attempts
// per client address in fifteen minutes, then 429. The session cookie is HttpOnly and SameSite=Lax.
import { z } from 'zod';
import { ApiError, handle, parseJson } from '@/lib/api';
import { AuthError, clientKey, loginCustomer, loginLimiter } from '@/lib/auth/login';
import { getSession } from '@/lib/session';

const body = z.object({ email: z.string().trim().email().max(256), password: z.string().min(1).max(256) });
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export const POST = handle(async (request: Request) => {
  const input = await parseJson(request, body);
  const { storeKey } = await getSession();
  if (!storeKey) throw new ApiError(404, 'Not found');
  if (!loginLimiter.allow(clientKey(request))) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '900' } });
  try {
    return Response.json(await loginCustomer({ storeKey, ...input }), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.code }, { status: 401, headers: NO_STORE });
    throw error;
  }
});
