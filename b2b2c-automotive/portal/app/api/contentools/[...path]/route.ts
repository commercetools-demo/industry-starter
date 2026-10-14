// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Hardened same-origin Contentools proxy for the embedded managers (workstream U-02). The browser never holds the JWT:
//   session (401) -> role check (403) -> allow-list and store check (400/404/405/403, no upstream call on any refusal)
//   -> size and content type (413/415) -> headers rebuilt from an allow-list -> server-held JWT on writes (503 when missing)
//   -> fetch upstream (redirect manual) -> answer without hop headers, cookies or upstream error bodies.
// The pure decisions live in lib/contentools/proxy-policy.ts and allowlist.ts (workstream X hardens those two files).
import { authorizeStore } from '@/lib/authz/authorize-store';
import { errorResponse, handle } from '@/lib/api';
import { getValidContentoolsJwt } from '@/lib/contentools/jwt';
import { CONTENTOOLS_ORIGIN } from '@/lib/contentools/origin';
import { getProjectKey } from '@/lib/contentools/project-key';
import { evaluateProxyRequest } from '@/lib/contentools/proxy-policy';
import { readSession } from '@/lib/portal/seam';
import { createTtlCache } from '@/lib/ttl-cache';
import type { Session } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PREFIX = '/api/contentools/';
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_MULTIPART_BYTES = 5 * 1024 * 1024 + 64 * 1024; // 5 MB file plus multipart envelope; the file itself is forwarded untouched
const UPSTREAM_TIMEOUT_MS = 15_000;
/** Request headers that may reach Contentools; everything else (cookie, authorization, x-forwarded-*, host, ...) is dropped. */
const FORWARD_REQUEST = ['accept', 'accept-language', 'content-type', 'if-none-match'] as const;
/** Never returned to the browser: hop headers (fetch already decoded the body), cookies and cross-origin grants. */
const DROP_RESPONSE = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie', 'location', 'www-authenticate', 'keep-alive']);
const NO_BODY_STATUS = new Set([204, 205, 304]);
const UPSTREAM_ERROR = () => Response.json({ error: { code: 'UPSTREAM_ERROR' } }, { status: 502, headers: { 'Cache-Control': 'no-store' } });

// Role lookups cost commercetools calls and the managers fire many requests: a short per-user cache (allowed answers only).
const roleCache = createTtlCache<boolean>({ ttlMs: 30_000, negativeTtlMs: 1000 });

async function requireEditor(session: Session, storeKey: string): Promise<void> {
  const key = `${session.customerId}|${session.businessUnitKey}|${storeKey}`;
  if (roleCache.get(key)) return;
  // Both Contentools areas (theme and content) are Admin-only; 'content.edit' and 'store.edit' share the same roles.
  await authorizeStore(session, storeKey, 'content.edit');
  roleCache.set(key, true);
}

function forwardHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-project-key', getProjectKey());
  return headers;
}

function answerHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (!DROP_RESPONSE.has(lower) && !lower.startsWith('access-control-')) headers.append(name, value);
  });
  return headers;
}

async function proxy(request: Request): Promise<Response> {
  const session = await readSession();
  if (!session.customerId) return errorResponse(401, 'Not signed in');
  if (!session.storeKey || session.pending || !session.businessUnitKey) return errorResponse(400, 'No store selected');
  await requireEditor(session, session.storeKey);

  const url = new URL(request.url);
  const rawPath = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : '';
  const base = { method: request.method, rawPath, query: url.search, sessionStoreKey: session.storeKey };
  const first = evaluateProxyRequest(base);
  if (!first.ok) return errorResponse(first.status, first.code === 'PROXY_STORE_MISMATCH' ? 'Store mismatch' : first.code === 'INVALID_PATH' ? 'Invalid path' : first.code === 'NOT_FOUND' ? 'Not found' : 'Method not allowed', first.code);

  let body: ArrayBuffer | undefined;
  if (first.write) {
    const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
    const isMultipart = contentType.startsWith('multipart/form-data');
    const isJson = contentType.startsWith('application/json');
    const limit = first.multipart ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES;
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > limit) return errorResponse(413, 'Request body too large', 'PAYLOAD_TOO_LARGE');
    body = await request.arrayBuffer();
    if (body.byteLength > limit) return errorResponse(413, 'Request body too large', 'PAYLOAD_TOO_LARGE');
    if (body.byteLength === 0) body = undefined;
    else if (first.multipart ? !isMultipart : !isJson) return errorResponse(415, 'Unsupported content type', 'UNSUPPORTED_MEDIA_TYPE');
    if (body && isJson) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(body));
      } catch {
        return errorResponse(400, 'Invalid JSON body', 'INVALID_BODY');
      }
      const second = evaluateProxyRequest({ ...base, bodyJson: parsed });
      if (!second.ok) return errorResponse(second.status, 'Store mismatch', second.code);
    }
  }

  const headers = forwardHeaders(request);
  let jwt: string | null = null;
  if (first.needsJwt) {
    jwt = await getValidContentoolsJwt();
    if (!jwt) return Response.json({ error: 'contentools_not_connected' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    headers.set('authorization', `Bearer ${jwt}`);
  }

  // Development only: the full upstream URL and the answer's status (never headers or bodies). Silence with CONTENTOOLS_PROXY_LOG=0.
  const logProxy = process.env.NODE_ENV !== 'production' && process.env.CONTENTOOLS_PROXY_LOG !== '0';
  const upstreamUrl = `${CONTENTOOLS_ORIGIN}/${first.upstreamPath}${first.upstreamSearch}`;
  if (logProxy) console.info(`contentools-proxy ${request.method} ${url.pathname}${url.search} -> ${upstreamUrl}`);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method === 'HEAD' ? 'GET' : request.method,
      headers,
      body: first.write ? body : undefined,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    if (logProxy) console.info(`contentools-proxy ${request.method} ${upstreamUrl} failed: ${error instanceof Error ? error.name : 'error'}`);
    return UPSTREAM_ERROR();
  }
  if (logProxy) console.info(`contentools-proxy ${request.method} ${upstreamUrl} => ${upstream.status}`);

  // A redirect would send the browser (or us) somewhere we did not allow; a 5xx body may echo what we sent.
  if (upstream.status >= 300 && upstream.status < 400) return UPSTREAM_ERROR();
  if (upstream.status >= 500) return UPSTREAM_ERROR();
  if (request.method === 'HEAD' || NO_BODY_STATUS.has(upstream.status)) return new Response(null, { status: upstream.status, headers: answerHeaders(upstream) });
  if (jwt) {
    // An upstream that reflects the Authorization header must never hand the token to the browser.
    const text = await upstream.text();
    if (text.includes(jwt)) return UPSTREAM_ERROR();
    return new Response(text, { status: upstream.status, headers: answerHeaders(upstream) });
  }
  return new Response(upstream.body, { status: upstream.status, headers: answerHeaders(upstream) });
}

const handler = handle(proxy);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = async (): Promise<Response> => new Response(null, { status: 204 });
