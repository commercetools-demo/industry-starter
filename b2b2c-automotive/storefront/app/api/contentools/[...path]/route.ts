// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Same-origin, READ-ONLY Contentools proxy for the browser (Puck blocks load data through it). The storefront holds no
// Contentools JWT: only the routes in lib/contentools/proxy-policy.ts pass; every other method or route is a 404 with no
// upstream request (so a write is 404, not 405). The visitor's cookies and Authorization never reach Contentools.
import { CONTENTOOLS_ORIGIN } from '@/lib/contentools/origin';
import { isAllowed } from '@/lib/contentools/proxy-policy';
import { getProjectKey } from '@/lib/contentools/project-key';

const NOT_FOUND = () => new Response(null, { status: 404 });
const MAX_BODY_BYTES = 16 * 1024; // the only POST is a page or content query
const UPSTREAM_TIMEOUT_MS = 10_000;

// Only these request headers reach Contentools (workstream X, D07): never the visitor's cookie or Authorization, our host, x-forwarded-*,
// a method override or an internal routing header. The project key is added below.
const FORWARD_REQUEST = ['accept', 'accept-language', 'content-type', 'if-none-match'] as const;
const NO_BODY_STATUS = new Set([204, 205, 304]);
const UPSTREAM_ERROR = () => Response.json({ error: { code: 'UPSTREAM_ERROR' } }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
// Stripped from the answer: fetch already decoded the body, so these would describe the still-encoded payload.
const DROP_RESPONSE = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie', 'location', 'www-authenticate', 'keep-alive']);

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path: segments } = await context.params;
  if (!isAllowed(request.method, segments)) return NOT_FOUND();

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-project-key', getProjectKey());

  let body: ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  }

  const search = new URL(request.url).search;
  let upstream: Response;
  try {
    upstream = await fetch(`${CONTENTOOLS_ORIGIN}/${segments.join('/')}${search}`, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return new Response(null, { status: 502 });
  }

  // A redirect would send the visitor somewhere we did not allow (X, D12); a 5xx body may echo what we sent (X, D13).
  if ((upstream.status >= 300 && upstream.status < 400 && !NO_BODY_STATUS.has(upstream.status)) || upstream.status >= 500) return UPSTREAM_ERROR();

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!DROP_RESPONSE.has(name.toLowerCase())) responseHeaders.append(name, value);
  });
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
