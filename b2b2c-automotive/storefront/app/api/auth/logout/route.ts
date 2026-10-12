// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/auth/logout` -> `{ ok: true }`: drops `customerId` and `cartId` from the session and rotates `anonymousId`, so the next cart
// is a fresh anonymous one and never the customer's. The client clears its cart and account caches (`useAccount().logout`).
import { handle } from '@/lib/api';
import { updateSession } from '@/lib/session';

export const POST = handle(async () => {
  await updateSession((s) => {
    const next = { ...s, anonymousId: crypto.randomUUID() };
    delete next.customerId;
    delete next.cartId;
    return next;
  });
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
});
