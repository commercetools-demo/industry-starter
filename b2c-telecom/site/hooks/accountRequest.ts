'use client';

/** A refused or failed /api/account request: `code` is the stable code of that API (`INVALID_ADDRESS`, `ADDRESS_UNRESOLVED`, `LIST_FULL`, ...) or `NETWORK`. */
export class AccountApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AccountApiError';
  }
}

const UNAVAILABLE = 'The service is temporarily unavailable';

/** One call of an /api/account route. Non-OK answers throw `AccountApiError` with the server's code and details. */
export async function accountRequest<T>(url: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  } catch {
    throw new AccountApiError('NETWORK', UNAVAILABLE, 0);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    const error = typeof payload === 'object' && payload !== null ? (payload as { error?: { code?: unknown; message?: unknown; details?: unknown } }).error : undefined;
    throw new AccountApiError(
      typeof error?.code === 'string' ? error.code : 'UNKNOWN',
      typeof error?.message === 'string' ? error.message : UNAVAILABLE,
      response.status,
      typeof error?.details === 'object' && error.details !== null ? (error.details as Record<string, unknown>) : undefined,
    );
  }
  if (typeof payload !== 'object' || payload === null) throw new AccountApiError('UNKNOWN', UNAVAILABLE, response.status);
  return payload as T;
}
