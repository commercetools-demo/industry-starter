// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

async function load() {
  vi.resetModules();
  vi.stubEnv('CONTENTOOLS_ORIGIN', 'https://cms.example.com');
  vi.stubEnv('CTP_PROJECT_KEY', 'proj-1');
  return import('./route');
}
const ctx = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
const req = (url: string, init?: RequestInit) => new Request(`http://localhost:3011/api/contentools/${url}`, init);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Write through the storefront proxy', () => {
  it('Write through the storefront proxy', async () => {
    const { PUT } = await load();
    const path = 'service/qa-green/configuration/theme';
    const res = await PUT(req(path, { method: 'PUT', body: '{}' }), ctx(path));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('POST write routes are 404', async () => {
    const { POST } = await load();
    for (const path of ['service/qa-green/configuration/theme', 'service/qa-green/puck-pages', 'service/qa-green/upload-file', 'service/products/search']) {
      expect((await POST(req(path, { method: 'POST', body: '{}' }), ctx(path))).status, path).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Delete is 404', async () => {
    const { DELETE, PATCH, OPTIONS, HEAD } = await load();
    const path = 'service/qa-green/configuration/theme';
    for (const [handler, method] of [[DELETE, 'DELETE'], [PATCH, 'PATCH'], [OPTIONS, 'OPTIONS'], [HEAD, 'HEAD']] as const) {
      expect((await handler(req(path, { method }), ctx(path))).status, method).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Other service routes are 404', async () => {
    const { GET } = await load();
    for (const path of ['service/qa-green/configuration', 'service/refresh-jwt', 'service/proxy-script', 'service/auth', 'service/qa-green/configuration/header']) {
      expect((await GET(req(`${path}?url=https://example.com`), ctx(path))).status, path).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Invalid store segment is 404', async () => {
    const { GET } = await load();
    const path = 'service/a/configuration/theme';
    expect((await GET(req(path), ctx(path))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Contentools reads and the same-origin proxy: forwarding', () => {
  it('Theme read is forwarded', async () => {
    fetchMock.mockResolvedValue(new Response('{"colorPrimary":"#1f6f43"}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const { GET } = await load();
    const path = 'service/qa-green/configuration/theme';
    const res = await GET(
      req(`${path}?x=1`, { headers: { cookie: 'session=SECRET', authorization: 'Bearer abc', host: 'evil.example', 'x-store-key': 'evil', 'x-project-key': 'spoofed', accept: 'application/json' } }),
      ctx(path),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ colorPrimary: '#1f6f43' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://cms.example.com/service/qa-green/configuration/theme?x=1');
    const sent = new Headers(init.headers);
    expect(sent.get('x-project-key')).toBe('proj-1');
    expect(sent.get('accept')).toBe('application/json');
    for (const h of ['host', 'cookie', 'authorization', 'x-store-key']) expect(sent.has(h), h).toBe(false);
    expect(init.redirect).toBe('manual');
    expect(init.body).toBeUndefined();
  });
  it('Published page query is forwarded with the body', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const { POST } = await load();
    const path = 'service/qa-green/published/puck-pages/query';
    const body = JSON.stringify({ query: 'slug = "/home"' });
    await POST(req(path, { method: 'POST', body, headers: { 'content-type': 'application/json' } }), ctx(path));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://cms.example.com/service/qa-green/published/puck-pages/query');
    expect(init.method).toBe('POST');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(body);
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });
  it('Oversized query body is refused', async () => {
    const { POST } = await load();
    const path = 'service/qa-green/published/puck-pages/query';
    const res = await POST(req(path, { method: 'POST', body: 'x'.repeat(20_000) }), ctx(path));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Hop-by-hop response headers are stripped', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-encoding': 'gzip', 'content-length': '999', 'transfer-encoding': 'chunked', connection: 'keep-alive', 'content-type': 'application/json', etag: 'abc' } }));
    const { GET } = await load();
    const path = 'service/qa-green/configuration/theme';
    const res = await GET(req(path), ctx(path));
    for (const h of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) expect(res.headers.has(h), h).toBe(false);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('etag')).toBe('abc');
  });
  it('Set-Cookie from upstream is stripped', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200, headers: { 'set-cookie': 'tracker=1; Path=/' } }));
    const { GET } = await load();
    const path = 'service/qa-green/configuration/theme';
    expect((await GET(req(path), ctx(path))).headers.has('set-cookie')).toBe(false);
  });
  it('Redirect is not followed and is not handed to the visitor: 502 UPSTREAM_ERROR, no Location (workstream X, D12)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://elsewhere.example/' } }));
    const { GET } = await load();
    const path = 'service/qa-green/configuration/theme';
    const res = await GET(req(path), ctx(path));
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('Upstream failure is a 502 without detail', async () => {
    fetchMock.mockRejectedValue(new TypeError('connect ECONNREFUSED 10.0.0.1:443'));
    const { GET } = await load();
    const path = 'service/qa-green/configuration/theme';
    const res = await GET(req(path), ctx(path));
    expect(res.status).toBe(502);
    expect(await res.text()).toBe('');
  });
});
