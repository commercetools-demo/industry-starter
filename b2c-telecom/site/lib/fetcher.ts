// Client-safe fetch helpers for hooks. Non-OK responses throw the shared ApiError.
import { ApiError, isApiErrorCode, type ApiErrorCode } from '@/lib/api-error';

const UNAVAILABLE = 'The service is temporarily unavailable';

function statusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL';
    default:
      return 'UPSTREAM_ERROR';
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError('UPSTREAM_ERROR', UNAVAILABLE);
  }
  const data = await readJson(response);
  if (!response.ok) {
    const error = typeof data === 'object' && data !== null ? (data as { error?: unknown }).error : undefined;
    if (typeof error === 'object' && error !== null) {
      const { code, message, details } = error as { code?: unknown; message?: unknown; details?: unknown };
      if (isApiErrorCode(code) && typeof message === 'string') {
        throw new ApiError(code, message, typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : undefined);
      }
    }
    throw new ApiError(statusToCode(response.status), UNAVAILABLE);
  }
  if (data === undefined) throw new ApiError('UPSTREAM_ERROR', UNAVAILABLE);
  return data as T;
}

export function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return request<T>(url, init);
}

export function sendJson<T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return request<T>(url, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
}
