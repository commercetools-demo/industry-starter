import 'server-only';
import type { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error';
import { MAX_BODY_BYTES, MIN_RESPONSE_MS } from '@/lib/config/auth';
import { json } from '@/lib/ct/http';
import { updateSession } from '@/lib/ct/session';

// Shared by the five /api/auth routes. Every answer is `Cache-Control: no-store` (json() sets it).

/** Auth-specific stable codes (not ApiErrorCodes: they belong to this API only, like the offer rule codes of J and K). */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'INVALID_INPUT'
  | 'WEAK_PASSWORD'
  | 'ACCOUNT_EXISTS'
  | 'INVALID_TOKEN'
  | 'RATE_LIMITED'
  | 'FORBIDDEN'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE';

export const INVALID_CREDENTIALS_MESSAGE = 'Enter a valid email and password.';
export const RATE_LIMITED_MESSAGE = 'Too many attempts. Try again later.';

export function authError(status: number, code: AuthErrorCode, message: string, details?: Record<string, unknown>, headers?: Record<string, string>): NextResponse {
  return json({ error: { code, message, ...(details ? { details } : {}) } }, { status, ...(headers ? { headers } : {}) });
}

/** HTTP 401, identical for every kind of failed sign-in. */
export const invalidCredentials = (): NextResponse => authError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE);

export const rateLimited = (retryAfterSeconds: number): NextResponse =>
  authError(429, 'RATE_LIMITED', RATE_LIMITED_MESSAGE, undefined, { 'retry-after': String(Math.max(1, Math.ceil(retryAfterSeconds))) });

/** A refusal that carries an auth code and an HTTP status (thrown by readAuthBody and the routes, answered by authFailure). */
export class AuthRefusal extends Error {
  constructor(
    public status: number,
    public code: AuthErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthRefusal';
  }

  toResponse(): NextResponse {
    return authError(this.status, this.code, this.message, this.details);
  }
}

/** JSON object body: content type JSON required (415), at most 4 KB (413), an object (400). */
export async function readAuthBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    throw new AuthRefusal(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content type must be application/json.');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) throw new AuthRefusal(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new AuthRefusal(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AuthRefusal(400, 'INVALID_INPUT', 'The request body must be JSON.');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new AuthRefusal(400, 'INVALID_INPUT', 'The request body must be a JSON object.');
  return raw as Record<string, unknown>;
}

export const stringField = (body: Record<string, unknown>, name: string): string => (typeof body[name] === 'string' ? (body[name] as string) : '');

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until at least `minMs` have passed since `startedAt` (hides timing differences between answers). */
export async function padResponse(startedAt: number, minMs: number = MIN_RESPONSE_MS): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

/** Writes the signed-in session (fresh token, so a fresh `iat`) and replaces the cart reference. Keeps `anonymousId`. */
export async function startCustomerSession(response: NextResponse, customerId: string, cartId: string | undefined): Promise<void> {
  await updateSession({ customerId, cartId, signedInAt: String(Date.now()) }, response);
}

/**
 * Maps what a route throws: refusals and ApiErrors keep their status; a commercetools or network failure is a generic 502; the rest a
 * generic 500. Only the error name and status are logged: an SDK error carries the original request, which holds the password.
 */
export function authFailure(error: unknown): NextResponse {
  if (error instanceof AuthRefusal) return error.toResponse();
  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') return authError(403, 'FORBIDDEN', error.message);
    return json(error.toBody(), { status: error.status });
  }
  const status = typeof (error as { statusCode?: unknown } | null)?.statusCode === 'number' ? (error as { statusCode: number }).statusCode : undefined;
  console.error('[auth] failure', error instanceof Error ? error.name : 'unknown', status ?? '');
  if (status !== undefined) return json({ error: { code: 'UPSTREAM_ERROR', message: 'The service is temporarily unavailable' } }, { status: 502 });
  return json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }, { status: 500 });
}
