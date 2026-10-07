import 'server-only';
import type { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error';
import { requireCustomerApi, type CustomerContext } from '@/lib/auth/guard';
import { assertSameOrigin } from '@/lib/auth/origin';
import { errorResponse, json } from '@/lib/ct/http';

// Shared by the /api/account/* routes of workstream T (addresses, payment methods, lists). Every answer is
// `Cache-Control: private, no-store`; a signed-out request is 401 UNAUTHENTICATED; the customer is ALWAYS the session's (D-070).

const MAX_BODY_BYTES = 16_384;

/** A refusal with this API's own stable code (E's ApiError code set is closed). */
export class AccountRefusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AccountRefusal';
  }
}

const PRIVATE = { 'cache-control': 'private, no-store' };

function privately(response: NextResponse): NextResponse {
  response.headers.set('cache-control', PRIVATE['cache-control']);
  return response;
}

const statusCodeOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : undefined;

/** Maps what a route throws. Only the error name and status are logged: an SDK error carries the request (an address, a card record). */
function failure(error: unknown): NextResponse {
  if (error instanceof AccountRefusal) {
    return privately(json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, { status: error.status }));
  }
  if (error instanceof ApiError) return privately(errorResponse(error));
  const status = statusCodeOf(error);
  console.error('[account-api] failure', error instanceof Error ? error.name : 'unknown', status ?? '');
  if (status === 404) return privately(errorResponse(new ApiError('NOT_FOUND', 'Not found')));
  if (status === 409) return privately(errorResponse(new ApiError('CONFLICT', 'The resource was changed, retry')));
  if (status !== undefined || (error instanceof Error && error.name === 'UpstreamTimeoutError')) {
    return privately(errorResponse(new ApiError('UPSTREAM_ERROR', 'The service is temporarily unavailable')));
  }
  return privately(errorResponse(new ApiError('INTERNAL', 'Something went wrong')));
}

export interface AccountRouteOptions {
  /** A write: the request must come from this site (CSRF guard, like every auth POST). */
  mutating?: boolean;
  /** HTTP status of a successful answer (default 200). */
  status?: number;
}

/**
 * Runs one account route: same-origin check for writes, the signed-in customer (401 otherwise), the handler, the JSON answer.
 * Handlers throw `AccountRefusal` or `ApiError`; `redirect()`-style control flow is never used here.
 */
export async function accountRoute<T>(request: Request, options: AccountRouteOptions, run: (context: CustomerContext) => Promise<T>): Promise<NextResponse> {
  try {
    if (options.mutating) assertSameOrigin(request);
    const context = await requireCustomerApi();
    const data = await run(context);
    return privately(json(data, { status: options.status ?? 200 }));
  } catch (error) {
    return failure(error);
  }
}

/** The JSON object body of a request (at most 16 KB); anything else is 400 INVALID_BODY. An absent body reads as `{}`. */
export async function readJsonBody(request: Request, { allowEmpty = false }: { allowEmpty?: boolean } = {}): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new AccountRefusal(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  if (allowEmpty && text.trim() === '') return {};
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AccountRefusal(400, 'INVALID_BODY', 'The request body must be JSON.');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new AccountRefusal(400, 'INVALID_BODY', 'The request body must be a JSON object.');
  return raw as Record<string, unknown>;
}
