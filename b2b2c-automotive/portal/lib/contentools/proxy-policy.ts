// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The pure decision of the same-origin Contentools proxy (workstream U section 7; workstream X hardens this file and
// `allowlist.ts`). No I/O: the route handler turns a refusal into a response and makes no upstream call.
//
// Order of the checks: path hygiene (400 INVALID_PATH), method (405), allow-list (404), store (403 PROXY_STORE_MISMATCH).
// Strict store mode is the default: a store segment, `businessUnitKey` or `storeKey` that is not the session's store is a 403.
// PROXY_STRICT_STORE=false rewrites the path segment and the query instead, and is honoured only outside production.
import 'server-only';
import { matchPath } from './allowlist';

export type ProxyRefusal =
  | { ok: false; status: 400; code: 'INVALID_PATH' }
  | { ok: false; status: 403; code: 'PROXY_STORE_MISMATCH' }
  | { ok: false; status: 404; code: 'NOT_FOUND' }
  | { ok: false; status: 405; code: 'METHOD_NOT_ALLOWED' };

export interface ProxyAllowed {
  ok: true;
  /** `service/<store>/...` as sent upstream (the store segment is always the session's store). */
  upstreamPath: string;
  /** Query string with a leading `?`, or an empty string. */
  upstreamSearch: string;
  /** Whether a request body may be multipart/form-data (only `upload-file`). */
  multipart: boolean;
  /** Whether the method is anything but GET or HEAD (a body is forwarded). */
  write: boolean;
  /** Whether the server-held JWT is attached (a write that is not a read-only query POST). */
  needsJwt: boolean;
}

export type ProxyDecision = ProxyAllowed | ProxyRefusal;

export interface ProxyRequest {
  method: string;
  /** The path after `/api/contentools/` exactly as received (not decoded), for example `service/mau-reseller-north/configuration/theme`. */
  rawPath: string;
  /** The raw query string, with or without the leading `?`. */
  query?: string;
  /** The parsed JSON body of a write request, when there is one. */
  bodyJson?: unknown;
  sessionStoreKey: string;
}

const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
/** Parameters and JSON keys that name a store; any value other than the session's store is refused. */
const STORE_FIELDS = new Set(['businessUnitKey', 'storeKey']);
const MAX_JSON_DEPTH = 20;
const refuse = (status: 400 | 403 | 404 | 405, code: ProxyRefusal['code']) => ({ ok: false, status, code }) as ProxyRefusal;

/** True outside production when PROXY_STRICT_STORE=false (workstream X test D02). Ignored in production. */
export function strictStore(env: NodeJS.ProcessEnv = process.env): boolean {
  return !(env.NODE_ENV !== 'production' && env.PROXY_STRICT_STORE === 'false');
}

/** Path hygiene: nothing percent-encoded, no traversal, no empty segment, no control, whitespace or backslash character. */
function cleanSegments(rawPath: string): string[] | null {
  // A real key never needs percent-encoding, so any `%` is refused: this covers %2f, %5c, %2e, %00, %09 and double encoding.
  if (/%|\\|\.\.|[\u0000- \u007f]/.test(rawPath)) return null;
  const segments = rawPath.split('/');
  if (segments.some((s) => s === '' || s === '.')) return null;
  return segments;
}

function mismatchedStoreFields(value: unknown, storeKey: string, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return true;
  if (Array.isArray(value)) return value.some((v) => mismatchedStoreFields(v, storeKey, depth + 1));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => (STORE_FIELDS.has(k) && v !== storeKey && v !== undefined) || mismatchedStoreFields(v, storeKey, depth + 1));
  }
  return false;
}

export function evaluateProxyRequest(request: ProxyRequest): ProxyDecision {
  const segments = cleanSegments(request.rawPath);
  if (!segments || segments[0] !== 'service') return refuse(segments ? 404 : 400, segments ? 'NOT_FOUND' : 'INVALID_PATH');
  const method = request.method.toUpperCase();
  if (!METHODS.has(method)) return refuse(405, 'METHOD_NOT_ALLOWED');

  const match = matchPath(segments.slice(1));
  if (!match) return refuse(404, 'NOT_FOUND');
  const effective = method === 'HEAD' ? 'GET' : method;
  if (!match.methods.includes(effective)) return refuse(405, 'METHOD_NOT_ALLOWED');

  const strict = strictStore();
  const session = request.sessionStoreKey;
  const path = [...segments];
  if (match.storeIndex !== null && path[1 + match.storeIndex] !== session) {
    if (strict) return refuse(403, 'PROXY_STORE_MISMATCH');
    path[1 + match.storeIndex] = session;
  }

  const params = new URLSearchParams(request.query?.replace(/^\?/, '') ?? '');
  for (const name of STORE_FIELDS) {
    for (const value of params.getAll(name)) {
      if (value === session) continue;
      if (strict) return refuse(403, 'PROXY_STORE_MISMATCH');
      params.set(name, session);
    }
  }
  if (request.bodyJson !== undefined && mismatchedStoreFields(request.bodyJson, session)) return refuse(403, 'PROXY_STORE_MISMATCH');

  const search = params.toString();
  const write = effective !== 'GET';
  // Page and content queries and the product search are POSTs that only read: they need the project key, not the JWT.
  const readOnlyPost = write && (/^service\/(?:[^/]+\/)?(?:published|preview)\/puck-(?:pages|contents)\/query$/.test(path.join('/')) || path.join('/') === 'service/products/search');
  return {
    ok: true,
    upstreamPath: path.join('/'),
    upstreamSearch: search ? `?${search}` : '',
    multipart: match.multipart,
    write,
    needsJwt: write && !readOnlyPost,
  };
}
