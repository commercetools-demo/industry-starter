/** Client-safe JSON helpers for SWR hooks. Do not import server-only code here. */
export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const error = typeof data === 'object' && data !== null ? (data as { error?: unknown }).error : undefined;
    throw new ApiError(typeof error === 'string' ? error : `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return parse<T>(await fetch(url, init));
}

export async function sendJson<T>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
