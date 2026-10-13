// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/account/delete` { password, confirm } -> `{ ok: true }` (workstream Q-11, D11). Needs the current password and the typed word
// (`DELETE`, `LÖSCHEN`). The account is anonymised (orders are kept), then the session is dropped like a sign-out and the anonymous id rotates.
import { z } from 'zod';
import { accountHandle, accountSession, AccountError, NO_STORE } from '@/lib/account/errors';
import { isDeleteWord } from '@/lib/account/delete-word';
import { parseJson } from '@/lib/api';
import { clientKey } from '@/lib/auth/login';
import { anonymiseCustomer } from '@/lib/ct/account-customer';
import { createRateLimiter } from '@/lib/rate-limit';
import { updateSession } from '@/lib/session';

const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const body = z.object({ password: z.string().min(1).max(256), confirm: z.string().max(32) });

export const POST = accountHandle(async (request: Request) => {
  const { storeKey, customerId } = await accountSession();
  const input = await parseJson(request, body);
  if (!isDeleteWord(input.confirm)) throw new AccountError('confirm-word');
  if (!limiter.allow(`${customerId}:${clientKey(request)}`)) return Response.json({ error: 'rate-limited' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '900' } });
  await anonymiseCustomer(storeKey, customerId, input.password);
  await updateSession((s) => {
    const next = { ...s, anonymousId: crypto.randomUUID() };
    delete next.customerId;
    delete next.cartId;
    return next;
  });
  return Response.json({ ok: true }, { headers: NO_STORE });
});
