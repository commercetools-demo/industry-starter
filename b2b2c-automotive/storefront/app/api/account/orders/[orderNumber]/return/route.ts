// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/account/orders/{orderNumber}/return` { items: [{ lineItemId, quantity }], reason, comment? } -> `{ returnNumber, tracking }`
// (workstream Q-07). The order must belong to the session's customer in the session's store. 409 `NOT_DELIVERED`, `RETURN_WINDOW_CLOSED` or
// `NOTHING_LEFT` when a return is not possible; 400 for a bad line, quantity or reason. The window is the store's `returnWindowDays` (30 by default).
import { z } from 'zod';
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { parseJson } from '@/lib/api';
import { requestReturn } from '@/lib/ct/account-orders';
import { getShellContext } from '@/lib/ct/shell';
import { getLocale } from '@/lib/session';

const body = z.object({
  items: z.array(z.object({ lineItemId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(999) })).min(1).max(50),
  reason: z.string().min(1).max(40),
  comment: z.string().trim().max(500).optional(),
});

export const POST = accountHandle(async (request: Request, { params }: { params: Promise<{ orderNumber: string }> }) => {
  const { orderNumber } = await params;
  const { storeKey, customerId } = await accountSession();
  const input = await parseJson(request, body);
  const { locale } = await getLocale();
  const shell = await getShellContext(storeKey, locale);
  const result = await requestReturn(storeKey, customerId, orderNumber, input, { windowDays: shell?.settings.returnWindowDays, locale });
  return Response.json(result, { headers: NO_STORE });
});
