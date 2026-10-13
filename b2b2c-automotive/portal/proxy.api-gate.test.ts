// @vitest-environment node
// Workstream X (C19, D5): the proxy runs the origin gate on every /api route before a handler is reached.
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const call = (method: string, headers: Record<string, string> = {}, path = '/api/seller/prices') =>
  proxy(new NextRequest(`http://localhost:3001${path}`, { method, headers: { host: 'localhost:3001', ...headers } }));

const page = (method: string) => proxy(new NextRequest('http://localhost:3001/de-DE/sign-in', { method, headers: { host: 'localhost:3001' } }));

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
  it('C19: a cross-site POST, a text/plain POST and a POST without Origin or Sec-Fetch-Site never reach the handler', async () => {
    const evil = await call('POST', { origin: 'http://evil.test', 'content-type': 'text/plain' });
    expect(evil.status).toBe(403);
    expect(await evil.json()).toMatchObject({ code: 'CROSS_ORIGIN' });
    expect((await call('POST', { 'content-type': 'application/json' })).status).toBe(403);
    expect((await call('PUT', { origin: 'null' })).status).toBe(403);
    expect((await call('DELETE', { 'sec-fetch-site': 'cross-site' }, '/api/seller/store/branches/x')).status).toBe(403);
    const text = await call('POST', { origin: 'http://localhost:3001', 'content-type': 'text/plain' });
    expect(text.status).toBe(415);
  });
  it('a same-origin JSON POST and any GET continue to the handler (no refusal status, no redirect)', async () => {
    for (const res of [await call('POST', { origin: 'http://localhost:3001', 'content-type': 'application/json' }), await call('GET'), await call('GET', {}, '/api/auth/me')]) {
      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });
});
