export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    /** Extra properties of the error body besides code and message (Workstream I: `details` of a refused discount code). */
    readonly extra: Record<string, unknown> = {},
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
    let extra: Record<string, unknown> = {};
    try {
      const body: unknown = await res.json();
      const error = (body as { error?: Record<string, unknown> } | null)?.error;
      if (typeof error?.code === 'string') code = error.code;
      if (error) {
        const { code: _code, message: _message, ...rest } = error;
        void _code;
        void _message;
        extra = rest;
      }
    } catch {
      // non-JSON error body: keep internal_error
    }
    throw new ApiError(code, res.status, extra);
  }
  return (await res.json()) as T;
}

/** For SWR. */
export const jsonFetcher = <T>(url: string): Promise<T> => fetchJson<T>(url);
