// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Route Handler helpers. Template for every handler under app/api/**:
//
//   export const POST = handle(async (request: Request) => {
//     const session = await getSession();
//     requireCustomer(session);                       // 401 before any commercetools call
//     requireBusinessUnit(session);                   // 400 'No active business unit'
//     const body = await parseJson(request, schema);  // 400 with the first zod issue
//     return Response.json(await doTheWork(session, body));   // lib/ct/* does the commercetools call
//   });
//
// Failures always have the body `{ "error": "<safe message>" }`; nothing from commercetools reaches the client.
import 'server-only';
import type { z } from 'zod';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/types';

/** The text shown for a 403 anywhere (spec: Permissions in two layers). Same string as `INSUFFICIENT` in `lib/authz/permissions.ts`. */
export const INSUFFICIENT_PERMISSIONS = 'Insufficient permissions to perform this task';

export const ERROR_MESSAGES = {
  401: 'Not signed in',
  403: INSUFFICIENT_PERMISSIONS,
  404: 'Not found',
  409: 'Conflict, please retry',
  500: 'Something went wrong',
} as const;

/**
 * An error whose status and message are safe to show. 400 keeps its own (validation) message; 401, 403, 404 and 409 use the
 * fixed texts above unless a machine `code` is given: a coded error is deliberate (for example `INVALID_CREDENTIALS`),
 * so its message is kept for 400 to 409 and the body is `{ error, code }`. Anything else becomes `Something went wrong`.
 */
export class ApiError extends AppError {
  constructor(
    status: number,
    message: string,
    public code?: string,
  ) {
    super(status, message);
    this.name = 'ApiError';
  }
}

export interface ApiFailure {
  status: number;
  error: string;
  code?: string;
}

function safeBody(status: number, message: string, code?: string): ApiFailure {
  if (status === 400) return { status, error: message || 'Invalid request', ...(code ? { code } : {}) };
  if (status === 401 || status === 403 || status === 404 || status === 409) {
    return code && message ? { status, error: message, code } : { status, error: ERROR_MESSAGES[status], ...(code ? { code } : {}) };
  }
  return { status: 500, error: ERROR_MESSAGES[500] };
}

/** Next's own control-flow errors (redirect, notFound, dynamic bailout) must pass through untouched. */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest.startsWith('NEXT_') || digest === 'DYNAMIC_SERVER_USAGE');
}

/** Maps any thrown value to `{ status, error }`: our `AppError`/`ApiError`, an SDK error (`statusCode`), or an unknown error (500). */
export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiError) return safeBody(error.status, error.message, error.code);
  if (error instanceof AppError) return safeBody(error.status, error.message);
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof statusCode === 'number') {
    // An SDK 400 or 401 means this app sent a bad request or has a bad client token: never the user's fault, never shown.
    if (statusCode === 403 || statusCode === 404 || statusCode === 409) return safeBody(statusCode, '');
  }
  return safeBody(500, '');
}

export function errorResponse(status: number, error: string, code?: string): Response {
  return Response.json({ error, ...(code ? { code } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Wraps a Route Handler: failures become safe `{ error }` bodies. Logs the status and the error class only,
 * never a body, header, message from commercetools or credential. Responses are `no-store` unless the handler set a policy.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A | [Request, ...unknown[]]) => Promise<Response> {
  // A handler that ignores its arguments still accepts the request Next passes (and tests send).
  return async (...args: A | [Request, ...unknown[]]) => {
    try {
      const response = await fn(...(args as A));
      if (!response.headers.has('Cache-Control')) {
        try {
          response.headers.set('Cache-Control', 'no-store');
        } catch {
          // immutable headers (a proxied Response): leave as is
        }
      }
      return response;
    } catch (error) {
      if (isNextControlFlow(error)) throw error;
      const failure = toApiFailure(error);
      if (failure.status >= 500) console.error(`api error: status=${failure.status} class=${error instanceof Error ? error.constructor.name : typeof error}`);
      return errorResponse(failure.status, failure.error, failure.code);
    }
  };
}

/** 401 when there is no signed-in customer. A reduced `pending` session counts as signed in only for the pending page. */
export function requireCustomer(session: Session): asserts session is Session & { customerId: string } {
  if (!session.customerId) throw new ApiError(401, ERROR_MESSAGES[401]);
}

/** 400 when no business unit is active (also for a reduced pending session). */
export function requireBusinessUnit(session: Session): asserts session is Session & { customerId: string; businessUnitKey: string } {
  requireCustomer(session);
  if (!session.businessUnitKey || session.pending) throw new ApiError(400, 'No active business unit');
}

/** 400 when the business unit has no resolved store (the five fields are written together, so this is a stale-session guard). */
export function requireStore(
  session: Session,
): asserts session is Session & {
  customerId: string;
  businessUnitKey: string;
  storeKey: string;
  distributionChannelId: string;
  supplyChannelId: string;
  productSelectionId: string;
} {
  requireBusinessUnit(session);
  if (!session.storeKey || !session.distributionChannelId || !session.supplyChannelId || !session.productSelectionId) {
    throw new ApiError(400, 'No store selected');
  }
}

/** Parses and validates a JSON body: 400 `Invalid JSON body` or the first zod issue message. */
export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(400, result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}
