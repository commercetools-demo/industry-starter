// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X: origin check (C19), audit log redaction (D8), static security headers (G01).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logDecision, redactDecision } from './audit-log';
import { apiGate, methodGate } from './api-gate';
import { securityHeaders } from './headers';
import { assertSameOrigin, isMutating } from './origin';

const call = (method: string, headers: Record<string, string>, url = 'http://localhost:3001/api/x') => assertSameOrigin({ method, url, headers: new Headers({ host: 'localhost:3001', ...headers }) });

describe('origin check', () => {
  it('safe methods pass without any header', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) expect(call(m, {})).toEqual({ ok: true });
    expect(isMutating('post')).toBe(true);
  });
  it('same Origin host passes for every mutating method', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(call(m, { origin: 'http://localhost:3001', 'content-type': 'application/json' })).toEqual({ ok: true });
  });
  it('C19: a foreign Origin is 403 CROSS_ORIGIN, even with a forged same-origin Sec-Fetch-Site', () => {
    expect(call('POST', { origin: 'http://evil.test', 'content-type': 'application/json' })).toMatchObject({ ok: false, status: 403, code: 'CROSS_ORIGIN' });
    expect(call('POST', { origin: 'http://evil.test', 'sec-fetch-site': 'same-origin' })).toMatchObject({ ok: false, status: 403 });
    expect(call('POST', { origin: 'null' })).toMatchObject({ ok: false, status: 403 });
    expect(call('POST', { origin: 'http://localhost:3002' })).toMatchObject({ ok: false, status: 403 });
    expect(call('POST', { origin: 'http://localhost:3001.evil.test' })).toMatchObject({ ok: false, status: 403 });
  });
  it('C19: no Origin and no Sec-Fetch-Site is refused; Sec-Fetch-Site cross-site and same-site are refused', () => {
    expect(call('POST', { 'content-type': 'application/json' })).toMatchObject({ ok: false, status: 403, code: 'CROSS_ORIGIN' });
    expect(call('DELETE', { 'sec-fetch-site': 'cross-site' })).toMatchObject({ ok: false, status: 403 });
    expect(call('POST', { 'sec-fetch-site': 'same-site' })).toMatchObject({ ok: false, status: 403 });
  });
  it('no Origin with Sec-Fetch-Site same-origin or none passes', () => {
    expect(call('POST', { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' })).toEqual({ ok: true });
    expect(call('POST', { 'sec-fetch-site': 'none' })).toEqual({ ok: true });
  });
  it('C19: text/plain and form bodies are 415, JSON, multipart and no body pass', () => {
    const same = { origin: 'http://localhost:3001' };
    expect(call('POST', { ...same, 'content-type': 'text/plain;charset=UTF-8' })).toMatchObject({ ok: false, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(call('POST', { ...same, 'content-type': 'application/x-www-form-urlencoded' })).toMatchObject({ ok: false, status: 415 });
    expect(call('POST', { ...same, 'content-type': 'application/json; charset=utf-8' })).toEqual({ ok: true });
    expect(call('POST', { ...same, 'content-type': 'multipart/form-data; boundary=x' })).toEqual({ ok: true });
    expect(call('POST', { ...same })).toEqual({ ok: true });
    expect(call('POST', { ...same, 'content-type': 'text/plain', 'content-length': '0' })).toEqual({ ok: true });
  });
  it('the host comes from the Host header, else from the request URL', () => {
    expect(assertSameOrigin({ method: 'POST', url: 'https://portal.example.com/api/x', headers: new Headers({ origin: 'https://portal.example.com' }) })).toEqual({ ok: true });
    expect(assertSameOrigin({ method: 'POST', url: 'https://portal.example.com/api/x', headers: new Headers({ origin: 'https://evil.test' }) })).toMatchObject({ ok: false });
  });
});

describe('api gate', () => {
  const req = (headers: Record<string, string>) => ({ method: 'POST', url: 'http://localhost:3001/api/x', headers: new Headers({ host: 'localhost:3001', ...headers }) });
  afterEach(() => vi.restoreAllMocks());
  it('refuses with the usual body and logs one deny line without headers or body', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const res = apiGate(req({ origin: 'http://evil.test', cookie: 'secret=1', authorization: 'Bearer abc' }), '/api/x');
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: 'Cross-origin request refused', code: 'CROSS_ORIGIN' });
    expect(res?.headers.get('cache-control')).toBe('no-store');
    expect(log).toHaveBeenCalledOnce();
    const line = JSON.parse(String(log.mock.calls[0][0]));
    expect(line).toMatchObject({ rule: 'origin', decision: 'deny', route: 'POST /api/x' });
    expect(JSON.stringify(line)).not.toMatch(/secret|abc|evil/);
  });
  it('lets a same-origin request through and honours an exact-path exemption', () => {
    expect(apiGate(req({ origin: 'http://localhost:3001' }), '/api/x')).toBeUndefined();
    expect(apiGate(req({ origin: 'http://evil.test' }), '/api/hand-off', ['/api/hand-off'])).toBeUndefined();
    expect(apiGate(req({ origin: 'http://evil.test' }), '/api/hand-off/more', ['/api/hand-off'])?.status).toBe(403);
  });
});

describe('page methods (G09)', () => {
  it('GET, HEAD, POST and OPTIONS pass; TRACE, PUT, PATCH, DELETE and CONNECT are 405 with an Allow header', () => {
    for (const m of ['GET', 'head', 'POST', 'OPTIONS']) expect(methodGate(m)).toBeUndefined();
    for (const m of ['TRACE', 'PUT', 'PATCH', 'DELETE', 'CONNECT']) {
      const res = methodGate(m);
      expect(res?.status, m).toBe(405);
      expect(res?.headers.get('allow')).toBe('GET, HEAD, POST, OPTIONS');
    }
  });
});

describe('audit log redacts', () => {
  it('drops keys named like token, authorization, cookie, password, email, jwt, secret and nested values', () => {
    const line = redactDecision({ rule: 'authz', decision: 'deny', route: 'GET /api/x', actor: 'c1', token: 't', Authorization: 'a', cookie: 'c', password: 'p', userEmail: 'e', jwt: 'j', clientSecret: 's', body: { a: 1 } }, () => new Date(0));
    expect(line).toEqual({ ts: '1970-01-01T00:00:00.000Z', rule: 'authz', decision: 'deny', route: 'GET /api/x', actor: 'c1' });
  });
  it('writes exactly one JSON line to stdout', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logDecision({ rule: 'ownership', decision: 'deny', route: 'GET /api/y', actor: 'c2' });
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ rule: 'ownership', decision: 'deny' });
    log.mockRestore();
  });
});

describe('static security headers', () => {
  const names = (h: { key: string }[]) => h.map((x) => x.key);
  it('G01: nosniff, referrer policy and permissions policy on every app', () => {
    const h = securityHeaders();
    expect(h).toEqual(expect.arrayContaining([{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }]));
    expect(h.find((x) => x.key === 'Permissions-Policy')?.value).toContain('geolocation=()');
    expect(names(h)).not.toContain('Strict-Transport-Security');
    expect(names(h)).not.toContain('X-Frame-Options');
  });
  it('HSTS only in production, DENY only when asked, geolocation only for the storefront', () => {
    expect(names(securityHeaders({ production: true }))).toContain('Strict-Transport-Security');
    expect(securityHeaders({ frameOptions: 'DENY' })).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' });
    expect(securityHeaders({ geolocation: true }).find((x) => x.key === 'Permissions-Policy')?.value).toContain('geolocation=(self)');
  });
});
