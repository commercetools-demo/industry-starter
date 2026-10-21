const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Body types an HTML form can send. `text/plain` is not listed: `new Request(url, { body })` defaults to it and every browser cross-site POST carries an Origin, which is refused above. */
const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data'];

export type GuardFailure = { code: 'forbidden_origin'; status: 403 } | { code: 'unsupported_media_type'; status: 415 };

/** The host names this request may legitimately have been addressed to (direct, or behind a proxy that forwards the host). */
function ownHosts(req: Request): string[] {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(req.url).host);
  } catch {
    // an unparsable URL has no host to add
  }
  const host = req.headers.get('host');
  if (host) hosts.add(host);
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwarded) hosts.add(forwarded);
  return [...hosts];
}

/**
 * Same-origin and content-type guard for state-changing handlers (workstream Q, S7).
 * - An `Origin` header that is present and not this app's host is refused (`forbidden_origin`, 403). No `Origin`
 *   (curl, server-to-server) is allowed: the session cookie is SameSite=Lax as well.
 * - An HTML form body type (urlencoded, multipart) is refused (415): every handler reads JSON.
 * Returns null when the request may go on.
 */
export function guardRequest(req: Request): GuardFailure | null {
  if (!MUTATING.has(req.method.toUpperCase())) return null;
  const origin = req.headers.get('origin');
  if (origin !== null) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null; // "null" (sandboxed iframe, file) and garbage are foreign
    }
    if (originHost === null || !ownHosts(req).includes(originHost)) return { code: 'forbidden_origin', status: 403 };
  }
  const type = (req.headers.get('content-type') ?? '').trim().toLowerCase();
  if (FORM_TYPES.some((t) => type.startsWith(t))) return { code: 'unsupported_media_type', status: 415 };
  return null;
}
