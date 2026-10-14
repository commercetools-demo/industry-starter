// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// `POST /api/impersonate/exit` -> `{ ok: true }` (workstream V-06): "Exit customer session". Marks the handoff record `ended` (the portal's
// contract: `malva-impersonation/<jti>` status `ended`) and signs the session out of the customer. Only an impersonation session is touched.
import { endRecord } from '@/lib/ct/impersonation';
import { handle } from '@/lib/api';
import { endedSession, isImpersonating } from '@/lib/impersonation/state';
import { getSession, setSessionCookie } from '@/lib/session';

export const POST = handle(async () => {
  const session = await getSession();
  if (isImpersonating(session)) {
    if (session.impJti) await endRecord(session.impJti);
    await setSessionCookie(endedSession(session, crypto.randomUUID()));
  }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
});
