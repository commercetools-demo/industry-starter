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

// Never forwarded upstream: the visitor's identity, our host, and the internal routing headers.
const DROP_REQUEST = new Set(['host', 'cookie', 'authorization', 'proxy-authorization', 'connection', 'content-length', 'x-store-key', 'x-next-intl-locale']);
// Stripped from the answer: fetch already decoded the body, so these would describe the still-encoded payload.
const DROP_RESPONSE = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie']);

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path: segments } = await context.params;
  if (!isAllowed(request.method, segments)) return NOT_FOUND();

  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!DROP_REQUEST.has(name.toLowerCase())) headers.set(name, value);
  });
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
