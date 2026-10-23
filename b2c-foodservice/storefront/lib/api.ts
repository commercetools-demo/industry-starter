import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { AppError, SAFE_MESSAGES, errorResponse, type ErrorCode } from '@/lib/errors';
import { guardRequest } from '@/lib/http/guard';
import { getSession, type Session } from '@/lib/session';

type Ctx = { params: Promise<Record<string, string>> };

export function jsonError(code: ErrorCode, status: number): Response {
  return Response.json({ error: { code, message: SAFE_MESSAGES[code] } }, { status });
}

/** Answers are per person or per session (cart, account, market): a shared cache must never keep one. A handler that wants a cache header sets its own. */
function noStoreByDefault(res: Response): Response {
  if (res.headers.has('Cache-Control')) return res;
  try {
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch {
    // a response with immutable headers (a proxied fetch) is rebuilt with the header added
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
}

/** Wraps a Route Handler body. Next control-flow errors (redirect, notFound) are rethrown, never swallowed. Every answer is `no-store` unless the handler set its own `Cache-Control`. */
export function handle(
  route: string,
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    const refused = guardRequest(req);
    if (refused) {
      const message = refused.code === 'forbidden_origin' ? 'The request origin is not allowed' : 'The request must be JSON';
      return noStoreByDefault(Response.json({ error: { code: refused.code, message } }, { status: refused.status }));
    }
    try {
      return noStoreByDefault(await fn(req, ctx));
    } catch (e) {
      unstable_rethrow(e);
      return noStoreByDefault(errorResponse(e, route));
    }
  };
}

/** The same 401 body whatever the reason: no hint about an expired or invalid cookie. */
export async function requireCustomer(): Promise<Session & { customerId: string }> {
  const session = await getSession();
  if (!session.customerId) throw new AppError('unauthorized', 401);
  return { ...session, customerId: session.customerId };
}
