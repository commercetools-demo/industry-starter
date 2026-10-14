// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X (C19, D5): the proxy runs the origin gate on every /api route before a handler is reached.
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { config, proxy } from './proxy';

vi.mock('@/lib/ct/stores', () => ({ getStoreContext: vi.fn() }));
vi.mock('@/lib/ct/impersonation', () => ({ getRecordStatus: vi.fn(), endRecord: vi.fn() }));

const call = (method: string, headers: Record<string, string> = {}, path = '/api/cart/lines') =>
  proxy(new NextRequest(`http://localhost:3000${path}`, { method, headers: { host: 'localhost:3000', ...headers } }));

const page = (method: string) => proxy(new NextRequest('http://localhost:3000/de-DE/sign-in', { method, headers: { host: 'localhost:3000' } }));

describe('proxy: page methods (G09)', () => {
  it('PUT, PATCH and DELETE on a page are 405 before any locale or store work (TRACE cannot be built as a fetch Request; see the methodGate unit test)', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) expect((await page(method)).status, method).toBe(405);
  });
  it('GET and POST on a page are not refused by the method gate', async () => {
    for (const method of ['GET', 'POST']) expect((await page(method)).status, method).not.toBe(405);
  });
});

describe('proxy: origin gate for /api', () => {
  it('the matcher covers /api so the gate cannot be skipped', () => {
    expect(config.matcher).toContain('/api/:path*');
  });
  it('C19: a cross-site POST, a text/plain POST and a POST without Origin or Sec-Fetch-Site never reach the handler (cart route too)', async () => {
    const evil = await call('POST', { origin: 'http://localhost:4020', 'content-type': 'text/plain' });
    expect(evil.status).toBe(403);
    expect(await evil.json()).toMatchObject({ code: 'CROSS_ORIGIN' });
    expect((await call('POST', { 'content-type': 'application/json' })).status).toBe(403);
    expect((await call('DELETE', { origin: 'http://evil.test' }, '/api/cart/items/abc')).status).toBe(403);
    expect((await call('POST', { origin: 'http://localhost:3000', 'content-type': 'text/plain' })).status).toBe(415);
  });
  it('a same-origin JSON POST and any GET continue to the handler', async () => {
    for (const res of [await call('POST', { origin: 'http://localhost:3000', 'content-type': 'application/json' }), await call('GET'), await call('GET', {}, '/api/auth/me')]) {
      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });
  it('the portal hand-off form post (V-06) is the one cross-origin exemption; its token is the credential', async () => {
    const res = await call('POST', { origin: 'http://localhost:3001', 'content-type': 'application/x-www-form-urlencoded' }, '/api/impersonate');
    expect(res.status).toBe(200);
    expect((await call('POST', { origin: 'http://localhost:3001' }, '/api/impersonate/exit')).status).toBe(403);
  });
});
