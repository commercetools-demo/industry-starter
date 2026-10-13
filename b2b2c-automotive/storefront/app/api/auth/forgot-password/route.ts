// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/auth/forgot-password` { email } (workstream Q-04, D4). The project sends no email (owner answer Q-P01): the reset link is shown on
// screen. With `DEMO_ONSCREEN_RESET` on, the answer is always 200 `{ ok: true, resetPath, demo: true }`: for a known email `resetPath` carries the real
// in-store password token (30 minutes); for an unknown email, another store's customer or a rate-limit hit it carries a decoy of the same
// length and alphabet that never works. So the shape does not reveal whether an account exists. With the flag off the answer is `{ ok: true }`.
// SECURITY TRADE-OFF (owner-acknowledged, M-Q02): anyone who knows an email address can reset that account's password in this demo. The token and
// the email are never logged; the link is only in this response body (never a cookie, never a URL of the forgot page).
import { z } from 'zod';
import { accountHandle, NO_STORE } from '@/lib/account/errors';
import { ApiError, parseJson } from '@/lib/api';
import { decoyToken, isOnScreenResetEnabled, rememberTokenShape, resetPath } from '@/lib/auth/demo-reset';
import { clientKey } from '@/lib/auth/login';
import { requestPasswordResetToken } from '@/lib/ct/account-customer';
import { createRateLimiter } from '@/lib/rate-limit';
import { getLocale, getSession } from '@/lib/session';

const perAddress = createRateLimiter({ limit: 20, windowMs: 15 * 60 * 1000 });
const perEmail = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const body = z.object({ email: z.string().trim().email().max(256) });

export const POST = accountHandle(async (request: Request) => {
  const { email } = await parseJson(request, body);
  if (!isOnScreenResetEnabled()) return Response.json({ ok: true }, { headers: NO_STORE });
  const { storeKey } = await getSession();
  if (!storeKey) throw new ApiError(404, 'Not found');
  const { locale } = await getLocale();

  // Both limiters always run so a limit hit costs the same as a normal request; a hit answers with a decoy (same shape and status).
  const allowed = [perAddress.allow(clientKey(request)), perEmail.allow(`${storeKey}:${email.toLowerCase()}`)].every(Boolean);
  const real = allowed ? await requestPasswordResetToken(storeKey, email) : null;
  if (real) rememberTokenShape(real);
  return Response.json({ ok: true, resetPath: resetPath(locale, storeKey, real ?? decoyToken()), demo: true }, { headers: NO_STORE });
});
