import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import {
  changeMarket, createSessionToken, getMarket, getSession, sanitizeSession, setMarketCookie, setSessionCookie,
} from '@/lib/session';
import { isLocaleKey } from '@/lib/utils';

// Self-verification aid for workstream D. Deleted in workstream Q; `npm run predeploy` fails while app/api/dev exists.
export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 });
const isProduction = () => process.env.NODE_ENV === 'production';

export const GET = handle('/api/dev/session', async (req) => {
  if (isProduction()) return notFound();
  const simulate = new URL(req.url).searchParams.get('simulate');
  if (simulate && /^\d{3}$/.test(simulate)) {
    throw { statusCode: Number(simulate), message: 'simulated upstream failure' };
  }
  const session = await getSession();
  return NextResponse.json({ session, market: await getMarket() });
});

export const POST = handle('/api/dev/session', async (req) => {
  if (isProduction()) return notFound();
  const raw: unknown = await req.json().catch(() => ({}));
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  let session = await getSession();
  let marketLocale: 'en-US' | 'en-CA' | undefined;
  if (isLocaleKey(body.market)) {
    marketLocale = body.market;
    session = changeMarket(session, marketLocale);
  }
  // Only the session fields are accepted; any other body key is ignored.
  const fields = { ...body };
  delete fields.market;
  session = { ...session, ...sanitizeSession(fields) };
  let res: NextResponse = NextResponse.json({ ok: true });
  res = setSessionCookie(res, await createSessionToken(session));
  if (marketLocale) res = setMarketCookie(res, marketLocale);
  return res;
});
