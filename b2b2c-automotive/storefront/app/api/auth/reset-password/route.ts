// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/auth/reset-password` { token, password } -> `{ ok: true }` (workstream Q-04). Invalid, decoy, used or expired tokens are one generic 400
// `invalid-token`; the password policy applies (400 `weak-password` with the rule). It never signs the shopper in (a leaked link cannot create a
// session): the page sends them to sign-in with a notice. Disabled (404) when the on-screen reset is off.
import { z } from 'zod';
import { accountHandle, NO_STORE } from '@/lib/account/errors';
import { ApiError, parseJson } from '@/lib/api';
import { isOnScreenResetEnabled } from '@/lib/auth/demo-reset';
import { clientKey } from '@/lib/auth/login';
import { MAX_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { resetPassword } from '@/lib/ct/account-customer';
import { createRateLimiter } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

const limiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
const body = z.object({ token: z.string().min(1).max(512), password: z.string().min(1).max(MAX_PASSWORD_LENGTH) });

export const POST = accountHandle(async (request: Request) => {
  if (!isOnScreenResetEnabled()) throw new ApiError(404, 'Not found');
  const { token, password } = await parseJson(request, body);
  const { storeKey } = await getSession();
  if (!storeKey) throw new ApiError(404, 'Not found');
  if (!limiter.allow(clientKey(request))) return Response.json({ error: 'rate-limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '900' } });
  await resetPassword(storeKey, token, password);
  return Response.json({ ok: true }, { headers: NO_STORE });
});
