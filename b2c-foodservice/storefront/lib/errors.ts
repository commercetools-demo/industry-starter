export type ErrorCode =
  | 'bad_request' | 'validation_failed' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'conflict' | 'rate_limited' | 'upstream_unavailable' | 'wrong_project' | 'internal_error';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message?: string,
    readonly correlationId?: string,
  ) {
    super(message ?? SAFE_MESSAGES[code]);
    this.name = 'AppError';
  }
}

/** Fixed English strings; the UI maps `code` to the i18n key `errors.<code>`. */
export const SAFE_MESSAGES: Record<ErrorCode, string> = {
  bad_request: 'The request could not be understood',
  validation_failed: 'Some of the information is not valid',
  unauthorized: 'Sign in required',
  forbidden: 'You do not have access to this',
  not_found: 'Not found',
  conflict: 'This changed while you were working. Please try again',
  rate_limited: 'Too many requests. Please try again shortly',
  upstream_unavailable: 'The service is temporarily unavailable. Please try again',
  wrong_project: 'The service is not configured correctly',
  internal_error: 'Something went wrong',
};

const NETWORK_RE = /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|network/i;

interface UpstreamLike {
  statusCode?: unknown;
  message?: unknown;
  headers?: Record<string, unknown>;
  originalRequest?: { headers?: Record<string, unknown> };
}

function asUpstream(e: unknown): UpstreamLike {
  return typeof e === 'object' && e !== null ? (e as UpstreamLike) : {};
}

function readCorrelationId(e: unknown): string | undefined {
  const u = asUpstream(e);
  const fromResponse = u.headers?.['x-correlation-id'];
  if (typeof fromResponse === 'string') return fromResponse;
  const fromRequest = u.originalRequest?.headers?.['X-Correlation-ID'];
  return typeof fromRequest === 'string' ? fromRequest : undefined;
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const u = asUpstream(e);
  const correlationId = readCorrelationId(e) ?? crypto.randomUUID();
  const status = typeof u.statusCode === 'number' ? u.statusCode : undefined;
  if (status === 400) return new AppError('validation_failed', 400, undefined, correlationId);
  if (status === 404) return new AppError('not_found', 404, undefined, correlationId);
  if (status === 409) return new AppError('conflict', 409, undefined, correlationId);
  if (status === 429) return new AppError('rate_limited', 429, undefined, correlationId);
  // Our own client or scopes are wrong, not the shopper's fault.
  if (status === 401 || status === 403) return new AppError('internal_error', 500, undefined, correlationId);
  if (status !== undefined && status >= 500) {
    return new AppError('upstream_unavailable', 503, undefined, correlationId);
  }
  if (status === undefined && typeof u.message === 'string' && NETWORK_RE.test(u.message)) {
    return new AppError('upstream_unavailable', 503, undefined, correlationId);
  }
  return new AppError('internal_error', 500, undefined, correlationId);
}

/** Logs one JSON line (no body, email, token or stack) and returns the safe JSON body. */
export function errorResponse(e: unknown, route: string): Response {
  const err = toAppError(e);
  const upstreamStatus = asUpstream(e).statusCode;
  const line = {
    route,
    code: err.code,
    status: err.status,
    correlationId: err.correlationId ?? crypto.randomUUID(),
    ...(typeof upstreamStatus === 'number' ? { upstreamStatus } : {}),
  };
  console.error(JSON.stringify(line));
  return Response.json(
    { error: { code: err.code, message: SAFE_MESSAGES[err.code] } },
    { status: err.status },
  );
}
