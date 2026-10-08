/** Default cookie name used by tests; workstream D owns the real name in lib/session.ts. */
export const TEST_SESSION_COOKIE = 'session';

/** Builds a `Request` for calling a Route Handler (`GET(makeRequest('/api/x'))`). */
export function makeRequest(url: string, init: RequestInit = {}): Request {
  const absolute = /^https?:\/\//.test(url) ? url : `http://localhost:3000${url}`;
  return new Request(absolute, init);
}

/** Returns `init` with the session cookie set (merged with any existing Cookie header). */
export function withSessionCookie(
  init: RequestInit = {},
  token = 'test-session-token',
  name = TEST_SESSION_COOKIE,
): RequestInit {
  const headers = new Headers(init.headers);
  const existing = headers.get('cookie');
  headers.set('cookie', existing ? `${existing}; ${name}=${token}` : `${name}=${token}`);
  return { ...init, headers };
}

/** Builds a JSON POST/PUT/PATCH request. */
export function makeJsonRequest(url: string, body: unknown, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  return makeRequest(url, { method: 'POST', ...init, headers, body: JSON.stringify(body) });
}
