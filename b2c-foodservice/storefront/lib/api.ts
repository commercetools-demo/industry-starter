import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { AppError, SAFE_MESSAGES, errorResponse, type ErrorCode } from '@/lib/errors';
import { getSession, type Session } from '@/lib/session';

type Ctx = { params: Promise<Record<string, string>> };

export function jsonError(code: ErrorCode, status: number): Response {
  return Response.json({ error: { code, message: SAFE_MESSAGES[code] } }, { status });
}

/** Wraps a Route Handler body. Next control-flow errors (redirect, notFound) are rethrown, never swallowed. */
export function handle(
  route: string,
  fn: (req: Request, ctx: Ctx) => Promise<Response>,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      unstable_rethrow(e);
      return errorResponse(e, route);
    }
  };
}

/** The same 401 body whatever the reason: no hint about an expired or invalid cookie. */
export async function requireCustomer(): Promise<Session & { customerId: string }> {
  const session = await getSession();
  if (!session.customerId) throw new AppError('unauthorized', 401);
  return { ...session, customerId: session.customerId };
}
