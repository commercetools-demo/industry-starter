import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { isKnownTimeZone } from '@/lib/agent/common/types';
import { guardAssistant } from '@/lib/agent/http/guard';
import { resolveSession, startSession } from '@/lib/agent/host/sessions';
import { getSessionStore } from '@/lib/agent/store';
import { ensureAssistantBag } from '@/lib/ct/assistant-cart';
import { createSessionToken, ensureAnonymousId, getMarket, getSession, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/assistant/session { timezone? } -> 200 { ok: true }. Starts (or keeps) the assistant session for the signed `malva-session`
 * and writes `agentSessionId` into it. The principal (customer or anonymous id, market) is bound from the cookie, never from the body. A
 * session for another user or another market is ended and replaced. 503 `assistant_disabled` while the switch is off.
 */
export const POST = handle('/api/assistant/session', async (req) => {
  const before = await getSession();
  const limited = guardAssistant(req, 'session', before.agentSessionId ?? before.anonymousId ?? '');
  if (limited) return limited;

  const body: unknown = await req.json().catch(() => null);
  const tz = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).timezone : undefined;
  const session = ensureAnonymousId(before);
  const userId = session.customerId ?? session.anonymousId ?? '';
  const principal = {
    userId,
    ...(session.customerId ? { customerId: session.customerId } : {}),
    ...(session.anonymousId ? { anonymousId: session.anonymousId } : {}),
    ...(session.country ? { country: session.country } : {}),
    ...(session.locale ? { locale: session.locale } : {}),
    ...(session.currency ? { currency: session.currency } : {}),
    ...(typeof tz === 'string' && tz.length <= 64 && isKnownTimeZone(tz) ? { timezone: tz } : {}),
  };

  const store = getSessionStore();
  const existing = await resolveSession(store, session.agentSessionId, principal);
  // The bag is made here, before the cookie is written: a stream cannot set cookies later (workstream T2, decision 5).
  const bagged = await ensureAssistantBag(session, await getMarket());
  if (existing && bagged === session && session === before) return NextResponse.json({ ok: true });

  const keep = existing ? existing.session.id : (await startSession(store, principal)).id;
  const res = NextResponse.json({ ok: true });
  return setSessionCookie(res, await createSessionToken({ ...bagged, agentSessionId: keep }));
});
