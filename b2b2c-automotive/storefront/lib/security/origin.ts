// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Same-origin and content-type gate for state-changing API calls (workstream X-05, decision D5). Pure: no `server-only`,
// no env access, so the proxy (middleware) and the tests share it. The session cookie is SameSite=Lax and HTTP-only; this is
// the second layer. No CSRF token: a browser always sends `Origin` on a cross-site POST and `Sec-Fetch-Site` on every request.
// The same file lives in storefront/lib/security/ and portal/lib/security/ (check-shared-copies style: keep them identical).

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type OriginVerdict = { ok: true } | { ok: false; status: 403 | 415; code: 'CROSS_ORIGIN' | 'UNSUPPORTED_MEDIA_TYPE' };

export const isMutating = (method: string): boolean => !SAFE_METHODS.has(method.toUpperCase());

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * A mutating request is same-origin when `Origin` names the host the request was sent to, or, when there is no `Origin`
 * (some same-origin navigations), when `Sec-Fetch-Site` is `same-origin` or `none`. A request with neither header is refused:
 * no browser omits both, so it is a script or a forged call. A present `Origin` always wins over `Sec-Fetch-Site`.
 */
export function isSameOrigin(headers: Headers, requestUrl: string): boolean {
  const host = (headers.get('host') ?? hostOf(requestUrl) ?? '').toLowerCase();
  const origin = headers.get('origin');
  if (origin !== null) return host !== '' && hostOf(origin) === host;
  const site = headers.get('sec-fetch-site');
  return site === 'same-origin' || site === 'none';
}

/** Whether the request declares a body this API never reads as JSON or multipart (a `text/plain` or form post is a CSRF carrier). */
function badContentType(headers: Headers): boolean {
  const type = (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type === '') return false; // no body type declared: handlers read JSON or nothing
  if (headers.get('content-length') === '0') return false;
  return type !== 'application/json' && type !== 'multipart/form-data';
}

/** The verdict for any request to `/api/**`: safe methods pass, mutating ones need same origin and a JSON or multipart body. */
export function assertSameOrigin(request: Pick<Request, 'method' | 'headers' | 'url'>): OriginVerdict {
  if (!isMutating(request.method)) return { ok: true };
  if (!isSameOrigin(request.headers, request.url)) return { ok: false, status: 403, code: 'CROSS_ORIGIN' };
  if (badContentType(request.headers)) return { ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' };
  return { ok: true };
}
