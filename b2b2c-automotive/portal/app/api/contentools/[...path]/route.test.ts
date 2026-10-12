// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { sessionFor } from '@/lib/authz/test-helpers';
import type { Session } from '@/lib/types';
import { makeRequest } from '@/test/request';

let session: Session = {};
const authorize = vi.fn(async (_s: Session, _k: string, _a: string) => undefined);
const getJwt = vi.fn(async (): Promise<string | null> => SERVER_JWT);
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session }));
vi.mock('@/lib/authz/authorize-store', () => ({ authorizeStore: (s: Session, k: string, a: string) => authorize(s, k, a) }));
vi.mock('@/lib/contentools/jwt', () => ({ getValidContentoolsJwt: () => getJwt() }));

import * as route from './route';

const SERVER_JWT = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJzZXJ2ZXIiLCJleHAiOjQxMDI0NDQ4MDB9.server-sig';
const PROXY = 'http://localhost:3000/api/contentools/';
const A = 'store-a';
const B = 'store-b';

let upstream: ReturnType<typeof vi.fn>;
const call = (handler: (r: Request) => Promise<Response>, path: string, init: RequestInit & { json?: unknown } = {}) => {
  const { json, ...rest } = init;
  return handler(
    new Request(PROXY + path, {
      ...rest,
      ...(json !== undefined ? { body: JSON.stringify(json), headers: { 'content-type': 'application/json', ...(rest.headers as Record<string, string>) } } : {}),
    }),
  );
};
const upstreamCall = (n = 0) => upstream.mock.calls[n] as [string, RequestInit & { headers: Headers }];

beforeEach(() => {
  session = sessionFor('adminA');
  authorize.mockClear();
  authorize.mockImplementation(async () => undefined);
  getJwt.mockClear();
  getJwt.mockImplementation(async () => SERVER_JWT);
  upstream = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', upstream);
});

describe('Contentools proxy', () => {
  it('401 without session and nothing is called', async () => {
    session = {};
    const res = await call(route.GET, `service/${A}/configuration/theme`);
    expect(res.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  it('403 for a Buyer before anything else, also on reads', async () => {
    authorize.mockRejectedValue(new ApiError(403, 'Forbidden'));
    session = sessionFor('buyerA');
    const res = await call(route.PUT, `service/${B}/configuration/theme`, { method: 'PUT', json: { value: {} } });
    expect(res.status).toBe(403);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), A, 'content.edit');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('tampered store: PUT /service/{storeB}/configuration/theme from store A is 403 PROXY_STORE_MISMATCH and upstream mock is never called', async () => {
    const res = await call(route.PUT, `service/${B}/configuration/theme`, { method: 'PUT', json: { value: { colorPrimary: '#ff0000' } } });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('PROXY_STORE_MISMATCH');
    expect(upstream).not.toHaveBeenCalled();
    expect(getJwt).not.toHaveBeenCalled();
  });

  it('a foreign store in the query or the JSON body is 403 with zero upstream calls', async () => {
    expect((await call(route.GET, `service/${A}/puck-pages?businessUnitKey=${B}`)).status).toBe(403);
    expect((await call(route.POST, `service/${A}/puck-pages`, { method: 'POST', json: { value: { storeKey: B } } })).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('path hygiene and other service routes: 400 INVALID_PATH, 404 for the rest, no upstream call', async () => {
    expect((await call(route.GET, `service/${A}/puck-pages/a%2fb`)).status).toBe(400);
    expect((await call(route.GET, 'service/refresh-jwt', { method: 'POST' })).status).toBe(404);
    expect((await call(route.POST, 'service/refresh-jwt', { method: 'POST' })).status).toBe(404);
    expect((await call(route.GET, `service/${A}/configuration`)).status).toBe(404);
    expect((await call(route.GET, `service/${A}/configuration/header`)).status).toBe(404);
    expect((await call(route.PATCH, `service/${A}/configuration/theme`, { method: 'PATCH' })).status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('GET gets x-project-key and no Authorization', async () => {
    await call(route.GET, `service/${A}/configuration/theme`, { headers: { authorization: 'Bearer browser', cookie: 'a=b' } });
    const [url, init] = upstreamCall();
    expect(url).toBe(`https://contentools.example.test/service/${A}/configuration/theme`);
    expect(init.headers.get('x-project-key')).toBe('test-project');
    expect(init.headers.get('authorization')).toBeNull();
    expect(getJwt).not.toHaveBeenCalled();
  });

  it('write request gets Authorization Bearer <server JWT>; client Authorization, cookie, x-project-key and x-forwarded-* are dropped', async () => {
    await call(route.PUT, `service/${A}/configuration/theme`, {
      method: 'PUT',
      json: { value: { colorPrimary: '#112233' } },
      headers: { authorization: 'Bearer server-managed', cookie: 'malva_portal_session=secret', 'x-project-key': 'evil', 'x-forwarded-for': '1.2.3.4', 'x-forwarded-host': 'evil.test', host: 'evil.test' },
    });
    const { headers } = upstreamCall()[1];
    expect(headers.get('authorization')).toBe(`Bearer ${SERVER_JWT}`);
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('x-project-key')).toBe('test-project');
    expect(headers.get('x-forwarded-for')).toBeNull();
    expect(headers.get('x-forwarded-host')).toBeNull();
    expect(headers.get('host')).toBeNull();
  });

  it('forwards the body only for non GET and HEAD; redirect is manual', async () => {
    await call(route.GET, `service/${A}/puck-pages`);
    expect(upstreamCall(0)[1].body).toBeUndefined();
    expect(upstreamCall(0)[1].redirect).toBe('manual');
    await call(route.POST, `service/${A}/puck-pages`, { method: 'POST', json: { value: { name: 'x' } } });
    expect(upstreamCall(1)[1].body).toBeInstanceOf(ArrayBuffer);
    await call(route.HEAD, `service/${A}/puck-pages`, { method: 'HEAD' });
    expect(upstreamCall(2)[1].body).toBeUndefined();
  });

  it('read-only query POSTs do not need or get the JWT', async () => {
    await call(route.POST, `service/${A}/published/puck-pages/query`, { method: 'POST', json: { query: 'slug = "/home"' } });
    expect(getJwt).not.toHaveBeenCalled();
    expect(upstreamCall()[1].headers.get('authorization')).toBeNull();
  });

  it('JWT null: write is 503 contentools_not_connected, GET still works', async () => {
    getJwt.mockResolvedValue(null);
    const write = await call(route.PUT, `service/${A}/configuration/theme`, { method: 'PUT', json: { value: {} } });
    expect(write.status).toBe(503);
    expect(await write.json()).toEqual({ error: 'contentools_not_connected' });
    expect(upstream).not.toHaveBeenCalled();
    const read = await call(route.GET, `service/${A}/configuration/theme`);
    expect(read.status).toBe(200);
  });

  it('upstream 3xx gives 502 without Location; upstream 5xx gives only UPSTREAM_ERROR; a network error too', async () => {
    upstream.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://evil.test/' } }));
    const redirect = await call(route.GET, `service/${A}/configuration/theme`);
    expect(redirect.status).toBe(502);
    expect(redirect.headers.get('location')).toBeNull();

    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'boom', authorization: `Bearer ${SERVER_JWT}`, stack: 'at x' }), { status: 500 }));
    const failed = await call(route.GET, `service/${A}/configuration/theme`);
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: { code: 'UPSTREAM_ERROR' } });

    upstream.mockRejectedValueOnce(new Error('ECONNRESET'));
    const dropped = await call(route.GET, `service/${A}/configuration/theme`);
    expect(dropped.status).toBe(502);
    expect(await dropped.json()).toEqual({ error: { code: 'UPSTREAM_ERROR' } });
  });

  it('upstream 4xx bodies pass through so the editors can show validation messages', async () => {
    upstream.mockResolvedValueOnce(Response.json({ message: 'slug already used' }, { status: 409 }));
    const res = await call(route.POST, `service/${A}/puck-pages`, { method: 'POST', json: { value: { slug: '/x' } } });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: 'slug already used' });
  });

  it('size and content type: 2 MB plus JSON body 413; non JSON write 415; multipart only on upload-file', async () => {
    const big = JSON.stringify({ value: 'x'.repeat(2 * 1024 * 1024 + 10) });
    const tooLarge = await call(route.PUT, `service/${A}/configuration/theme`, { method: 'PUT', body: big, headers: { 'content-type': 'application/json' } });
    expect(tooLarge.status).toBe(413);

    const text = await call(route.PUT, `service/${A}/configuration/theme`, { method: 'PUT', body: 'colorPrimary=1', headers: { 'content-type': 'text/plain' } });
    expect(text.status).toBe(415);

    const form = new FormData();
    form.set('file', new Blob(['abc'], { type: 'image/png' }), 'logo.png');
    const multipartElsewhere = await call(route.POST, `service/${A}/puck-pages`, { method: 'POST', body: form });
    expect(multipartElsewhere.status).toBe(415);
    expect(upstream).not.toHaveBeenCalled();

    const form2 = new FormData();
    form2.set('file', new Blob(['abc'], { type: 'image/png' }), 'logo.png');
    const upload = await call(route.POST, `service/${A}/upload-file`, { method: 'POST', body: form2 });
    expect(upload.status).toBe(200);
    expect(upstreamCall()[1].headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);

    const jsonOnUpload = await call(route.POST, `service/${A}/upload-file`, { method: 'POST', json: { a: 1 } });
    expect(jsonOnUpload.status).toBe(415);
  });

  it('a 11 MB multipart upload is 413', async () => {
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(11 * 1024 * 1024 + 10)]), 'big.png');
    const res = await call(route.POST, `service/${A}/upload-file`, { method: 'POST', body: form });
    expect(res.status).toBe(413);
  });

  it('response strips content-encoding, content-length, transfer-encoding, connection, set-cookie and location', async () => {
    upstream.mockResolvedValueOnce(
      new Response('{"a":1}', { status: 200, headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': '999', 'transfer-encoding': 'chunked', connection: 'keep-alive', 'set-cookie': 'sid=1', 'access-control-allow-origin': '*', 'x-keep': 'yes' } }),
    );
    const res = await call(route.GET, `service/${A}/configuration/theme`);
    for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie', 'access-control-allow-origin']) expect(res.headers.get(name)).toBeNull();
    expect(res.headers.get('x-keep')).toBe('yes');
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('responses never contain the JWT: an upstream that reflects it is replaced by UPSTREAM_ERROR', async () => {
    upstream.mockResolvedValueOnce(Response.json({ received: `Bearer ${SERVER_JWT}` }, { status: 400 }));
    const res = await call(route.PUT, `service/${A}/configuration/theme`, { method: 'PUT', json: { value: {} } });
    const text = await res.text();
    expect(text).not.toContain(SERVER_JWT);
    expect(res.status).toBe(502);
  });

  it('exports GET POST PUT PATCH DELETE HEAD and OPTIONS answers 204 with no CORS headers', async () => {
    for (const name of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const) expect(typeof route[name]).toBe('function');
    const res = await route.OPTIONS();
    expect(res.status).toBe(204);
    expect([...res.headers.keys()].filter((k) => k.startsWith('access-control'))).toEqual([]);
  });

  it('declares force-dynamic and the node runtime', () => {
    expect(route.dynamic).toBe('force-dynamic');
    expect(route.runtime).toBe('nodejs');
  });
});

describe('request helper sanity', () => {
  it('makeRequest is available for sibling tests', () => {
    expect(makeRequest('/x').url).toContain('/x');
  });
});
