import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error';

/** JSON response that is never cached (session-specific data). */
export function json<T>(data: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init);
  response.headers.set('cache-control', 'no-store');
  return response;
}

function statusCodeOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const value = (err as { statusCode: unknown }).statusCode;
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  return err instanceof TypeError || (typeof code === 'string' && /^(ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR)/.test(code));
}

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const status = statusCodeOf(err);
  if (status === 404) return new ApiError('NOT_FOUND', 'Not found');
  if (status === 409) return new ApiError('CONFLICT', 'The resource was changed, retry');
  if (status === 400) return new ApiError('VALIDATION', 'Invalid request');
  if (status !== undefined || isNetworkError(err)) {
    return new ApiError('UPSTREAM_ERROR', 'The service is temporarily unavailable');
  }
  return new ApiError('INTERNAL', 'Something went wrong');
}

/** Maps any thrown value to the shared error body. Never exposes upstream bodies, stacks or credentials. */
export function errorResponse(err: unknown): NextResponse {
  const apiError = toApiError(err);
  if (!(err instanceof ApiError)) console.error(err);
  const headers: Record<string, string> = {};
  if (apiError.code === 'RATE_LIMITED' && typeof apiError.details?.retryAfterSeconds === 'number') {
    headers['retry-after'] = String(apiError.details.retryAfterSeconds);
  }
  return json(apiError.toBody(), { status: apiError.status, headers });
}
