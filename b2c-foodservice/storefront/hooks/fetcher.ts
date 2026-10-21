export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Same-origin JSON call. Non-OK responses throw ApiError with the server's safe code. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError('upstream_unavailable', 0);
  }
  if (!res.ok) {
    let code = 'internal_error';
    try {
      const body: unknown = await res.json();
      const c = (body as { error?: { code?: unknown } } | null)?.error?.code;
      if (typeof c === 'string') code = c;
    } catch {
      // non-JSON error body: keep internal_error
    }
    throw new ApiError(code, res.status);
  }
  return (await res.json()) as T;
}

/** For SWR. */
export const jsonFetcher = <T>(url: string): Promise<T> => fetchJson<T>(url);
