// Client-safe fetch helper for SWR fetchers: turns a non-2xx `{ error }` response into an HttpError
// whose status the UI can act on (a 401 means "sign in again", not "access denied").

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** GET/POST helper for hooks: pass a path from `lib/api-paths.ts`. Throws HttpError on a non-2xx answer. */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = '';
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // not JSON: keep the empty message
    }
    throw new HttpError(response.status, message);
  }
  return (await response.json()) as T;
}

/** True when the error is a 401 from one of our endpoints (expired or absent session). */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof HttpError && error.status === 401;
}
