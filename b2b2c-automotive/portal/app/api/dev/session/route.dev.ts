// Development only: switches the fixture session so the shell can be checked as each role without credentials.
//   GET /api/dev/session?as=adminA|buyerA|adminB|pending|none&next=/de-DE
// Requires PORTAL_DEV_FIXTURES=on (404 otherwise and in production). The `.dev.ts` extension keeps it out of production builds.
import { fixtureContext, FIXTURE_USERS } from '@/lib/portal/dev-fixtures';
import { safeNextPath } from '@/lib/portal/flags';
import { devFixturesEnabled, writeSession, clearSession } from '@/lib/portal/seam';
import { applyBusinessContext, applyLocale } from '@/lib/session-core';

export async function GET(request: Request) {
  if (!devFixturesEnabled()) return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  const who = url.searchParams.get('as') ?? 'none';
  const next = safeNextPath(url.searchParams.get('next')) ?? '/de-DE';
  const user = FIXTURE_USERS.find((u) => u.who === who);
  if (!user) await clearSession();
  else if (user.pending) await writeSession(() => ({ customerId: user.id, pending: true }));
  else {
    const context = fixtureContext(user.id);
    if (context) await writeSession(() => applyLocale(applyBusinessContext({ customerId: user.id }, context), next.startsWith('/en-US') ? 'en-US' : 'de-DE'));
  }
  return Response.redirect(new URL(next, request.url), 303);
}
