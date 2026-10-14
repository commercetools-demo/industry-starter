// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/auth/register` { email, password, firstName?, lastName?, marketingConsent } -> `{ customer, count }` (workstream Q-03).
// The account is created in the session's store and the shopper is signed in at once: the anonymous cart merges and the sign-in hooks (garage
// merge) run, exactly as for a login. A duplicate email answers the same generic 400 `register-failed` as any other failure to create.
// Weak passwords answer 400 `weak-password` with the rule. Five registrations per client address in fifteen minutes, then 429.
import { z } from 'zod';
import { accountHandle, NO_STORE } from '@/lib/account/errors';
import { ApiError, parseJson } from '@/lib/api';
import { clientKey } from '@/lib/auth/login';
import { MAX_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import { registerCustomer } from '@/lib/ct/account-customer';
import { createRateLimiter } from '@/lib/rate-limit';
import { getSession } from '@/lib/session';

const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const body = z.object({
  email: z.string().trim().email().max(256),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  marketingConsent: z.boolean().default(false),
});

export const POST = accountHandle(async (request: Request) => {
  const input = await parseJson(request, body);
  const { storeKey } = await getSession();
  if (!storeKey) throw new ApiError(404, 'Not found');
  if (!limiter.allow(clientKey(request))) return Response.json({ error: 'rate-limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '900' } });
  return Response.json(await registerCustomer(storeKey, input), { headers: NO_STORE });
});
