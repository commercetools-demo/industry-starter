import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { sessionAfterLogout } from '@/lib/auth/session-customer';
import { createSessionToken, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** POST /api/auth/logout -> 200 { ok: true }. Idempotent. Keeps market and store; no anonymous id is created here. */
export const POST = handle('/api/auth/logout', async () => {
  const next = sessionAfterLogout(await getSession());
  return setSessionCookie(NextResponse.json({ ok: true }), await createSessionToken(next));
});
