// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `PUT /api/account/subscriptions/{id}` { action: 'skip' | 'pause' | 'resume' | 'cancel' } or { action: 'change-frequency', policyKey } ->
// `{ subscription }` as the API now has it (workstream Q-12). The recurring order must belong to the session's customer and store (404 otherwise).
import { z } from 'zod';
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { parseJson } from '@/lib/api';
import { runSubscriptionAction } from '@/lib/ct/account-subscriptions';
import { getLocale } from '@/lib/session';

const body = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['skip', 'pause', 'resume', 'cancel']) }),
  z.object({ action: z.literal('change-frequency'), policyKey: z.string().regex(/^[A-Za-z0-9_-]{2,256}$/) }),
]);

export const PUT = accountHandle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { storeKey, customerId } = await accountSession();
  const command = await parseJson(request, body);
  const { locale } = await getLocale();
  return Response.json({ subscription: await runSubscriptionAction(storeKey, customerId, id, command, locale) }, { headers: NO_STORE });
});
