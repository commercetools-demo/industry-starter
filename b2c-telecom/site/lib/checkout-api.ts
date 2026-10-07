import 'server-only';
import type { NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/auth/origin';
import { CheckoutRefusal } from '@/lib/checkout/refusal';
import { errorResponse, json } from '@/lib/ct/http';
import type { WithPatch } from '@/lib/ct/checkout';
import { getSession, updateSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';
import type { SessionData } from '@/lib/session-types';
import type { Market } from '@/lib/types';

// Shared by every /api/checkout route: same-origin check for writes, session and market, ONE function from `lib/ct/checkout`, the session
// patch, and the answer. A refusal is `{ error: { code, message, details? }, state? }` (state = the cart as it is now). All answers are private.

/** The body of a request as an object; anything else is 400 INVALID_BODY. */
export async function readCheckoutBody(request: Request): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new CheckoutRefusal(400, 'INVALID_BODY', 'The request body must be JSON.');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new CheckoutRefusal(400, 'INVALID_BODY', 'The request body must be a JSON object.');
  return raw as Record<string, unknown>;
}

const priv = (response: NextResponse): NextResponse => {
  response.headers.set('cache-control', 'private, no-store');
  return response;
};

export async function checkoutRoute<T>(request: Request, opts: { mutating?: boolean }, run: (session: SessionData, market: Market) => Promise<WithPatch<T>>): Promise<NextResponse> {
  try {
    if (opts.mutating) assertSameOrigin(request);
    const [session, market] = await Promise.all([getSession(), getMarket()]);
    const result = await run(session, market);
    const response = priv(json(result.data));
    if (result.patch) await updateSession(result.patch, response);
    return response;
  } catch (error) {
    if (error instanceof CheckoutRefusal) {
      return priv(json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }, ...(error.state ? { state: error.state } : {}) }, { status: error.status }));
    }
    return priv(errorResponse(error));
  }
}

/** A string field of a body, or undefined. */
export const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
