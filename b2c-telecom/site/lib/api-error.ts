// Client-safe API error shape shared by route handlers (server) and lib/fetcher.ts (client).

export const API_ERROR_STATUS = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UPSTREAM_ERROR: 502,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> };
};

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return API_ERROR_STATUS[this.code];
  }

  toBody(): ApiErrorBody {
    return {
      error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) },
    };
  }
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && value in API_ERROR_STATUS;
}
