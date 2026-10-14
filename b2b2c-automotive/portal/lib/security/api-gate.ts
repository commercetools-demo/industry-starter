// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The first gate of every `/api/**` request, run from proxy.ts before any Route Handler (workstream X-05, decision D5):
// a state-changing request must be same-origin and carry JSON or multipart. Refusals are logged as one JSON line (D8) and
// answered with the usual `{ error, code }` body. Identical copy in storefront/ and portal/.
import { logDecision } from './audit-log';
import { assertSameOrigin } from './origin';

const REFUSALS = {
  CROSS_ORIGIN: 'Cross-origin request refused',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported content type',
} as const;

const PAGE_METHODS = new Set(['GET', 'HEAD', 'POST', 'OPTIONS']);

/** G09: a page route answers GET and HEAD (and POST for Server Actions); TRACE, PUT, PATCH, DELETE and anything else is 405. */
export function methodGate(method: string): Response | undefined {
  if (PAGE_METHODS.has(method.toUpperCase())) return undefined;
  return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD, POST, OPTIONS', 'Cache-Control': 'no-store' } });
}

/**
 * `undefined` when the request may continue, else the refusal response (403 CROSS_ORIGIN or 415 UNSUPPORTED_MEDIA_TYPE).
 * `exempt` lists exact paths whose own credential replaces the origin check (the storefront "Shop as customer" hand-off is a
 * cross-origin form post from the portal, authorised by a single-use signed token).
 */
export function apiGate(request: Pick<Request, 'method' | 'headers' | 'url'>, pathname: string, exempt: readonly string[] = []): Response | undefined {
  if (exempt.includes(pathname)) return undefined;
  const verdict = assertSameOrigin(request);
  if (verdict.ok) return undefined;
  logDecision({ rule: 'origin', decision: 'deny', route: `${request.method} ${pathname}`, reason: verdict.code, actor: 'unknown' });
  return Response.json({ error: REFUSALS[verdict.code], code: verdict.code }, { status: verdict.status, headers: { 'Cache-Control': 'no-store' } });
}
