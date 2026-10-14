// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/account/password` { currentPassword, newPassword } -> `{ ok: true }` (workstream Q-11). The password policy applies (400
// `weak-password` with the rule); a wrong current password is one message (400 `wrong-password`). Five attempts per customer and client in fifteen minutes.
import { z } from 'zod';
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { parseJson } from '@/lib/api';
import { clientKey } from '@/lib/auth/login';
import { MAX_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { changePassword } from '@/lib/ct/account-customer';
import { createRateLimiter } from '@/lib/rate-limit';

const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const body = z.object({ currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH), newPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH) });

export const POST = accountHandle(async (request: Request) => {
  const { storeKey, customerId } = await accountSession();
  const input = await parseJson(request, body);
  if (!limiter.allow(`${customerId}:${clientKey(request)}`)) return Response.json({ error: 'rate-limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '900' } });
  await changePassword(storeKey, customerId, input);
  return Response.json({ ok: true }, { headers: NO_STORE });
});
