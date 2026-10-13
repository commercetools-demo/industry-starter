// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `DELETE /api/account/payment-methods/{id}` -> `{ ok: true }` (workstream Q-10). Ownership is checked in the query; another customer's id is a 404.
import { accountHandle, accountSession, NO_STORE } from '@/lib/account/errors';
import { deletePaymentMethod } from '@/lib/ct/account-payment-methods';

export const DELETE = accountHandle(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { customerId } = await accountSession();
  await deletePaymentMethod(customerId, id);
  return Response.json({ ok: true }, { headers: NO_STORE });
});
