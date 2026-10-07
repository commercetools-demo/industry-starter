import 'server-only';
import type { NextResponse } from 'next/server';
import { BundleRefusal } from '@/lib/cart/errors';
import { POSTAL_COOKIE, POSTAL_COOKIE_MAX_AGE } from '@/lib/config/eligibility';
import type { BundleOutcome } from '@/lib/ct/bundle';
import { errorResponse, json } from '@/lib/ct/http';
import { getSession, updateSession } from '@/lib/ct/session';
import { getMarket } from '@/lib/market/server';
import type { SessionData } from '@/lib/session-types';
import type { Market } from '@/lib/types';

// Shared by every /api/cart route: read session and market, run ONE bundle function, write the session when the cart changed, and answer
// with the full mapped cart. A refusal answers `{ error: { code, message, details? }, cart }` with the unchanged cart.

/** The body of a request as an object; anything else is 400 INVALID_BODY. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BundleRefusal(400, 'INVALID_BODY', 'The request body must be JSON.');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new BundleRefusal(400, 'INVALID_BODY', 'The request body must be a JSON object.');
  return raw as Record<string, unknown>;
}

export const invalidBody = (message: string): BundleRefusal => new BundleRefusal(400, 'INVALID_BODY', message);

async function syncSession(session: SessionData, result: BundleOutcome, response: NextResponse): Promise<void> {
  const patch: Partial<SessionData> = {};
  if (result.cartId !== session.cartId) patch.cartId = result.cartId;
  if (result.anonymousId && !session.anonymousId && !session.customerId) patch.anonymousId = result.anonymousId;
  if (Object.keys(patch).length > 0) await updateSession(patch, response);
}

export async function cartResponse(run: (session: SessionData, market: Market) => Promise<BundleOutcome>): Promise<NextResponse> {
  try {
    const session = await getSession();
    const market = await getMarket();
    const result = await run(session, market);
    const response = json({ cart: result.cart });
    await syncSession(session, result, response);
    if (result.postalCode) {
      response.cookies.set(POSTAL_COOKIE, result.postalCode, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: POSTAL_COOKIE_MAX_AGE });
    }
    return response;
  } catch (error) {
    if (error instanceof BundleRefusal) {
      return json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }, ...(error.cart !== undefined ? { cart: error.cart } : {}) }, { status: error.status });
    }
    return errorResponse(error);
  }
}
