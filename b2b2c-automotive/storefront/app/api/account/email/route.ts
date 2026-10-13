// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/account/email` { newEmail, currentPassword } -> `{ profile }` (workstream Q-11). The current password is checked first; a taken email and
// every other refusal answer the same `email-update-failed`. Five attempts per client address in fifteen minutes, then 429.
import { z } from 'zod';
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { parseJson } from '@/lib/api';
import { clientKey } from '@/lib/auth/login';
import { changeEmail } from '@/lib/ct/account-customer';
import { createRateLimiter } from '@/lib/rate-limit';

const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const body = z.object({ newEmail: z.string().trim().email().max(256), currentPassword: z.string().min(1).max(256) });

export const POST = accountHandle(async (request: Request) => {
  const { storeKey, customerId } = await accountSession();
  const input = await parseJson(request, body);
  if (!limiter.allow(`${customerId}:${clientKey(request)}`)) return Response.json({ error: 'rate-limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '900' } });
  return Response.json({ profile: await changeEmail(storeKey, customerId, input) }, { headers: NO_STORE });
});
