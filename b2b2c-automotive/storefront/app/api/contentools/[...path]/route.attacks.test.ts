// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X, attack group D (storefront half: read-only proxy) and E09 (the storefront holds no JWT) against the REAL route
// handler and the REAL fake Contentools server (tools/fake-contentools, child process on a free port, no commercetools call).
// The proof is the fake's own request log. Skipped when the fake is not checked out next to the storefront.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const FAKE_DIR = path.resolve(import.meta.dirname, '../../../../../tools/fake-contentools');
const PORT = vi.hoisted(() => 49000 + Math.floor(Math.random() * 8000));
vi.hoisted(() => {
  process.env.CONTENTOOLS_ORIGIN = `http://127.0.0.1:${PORT}`;
  process.env.CTP_PROJECT_KEY = 'spec-test-attack';
});

import * as route from './route';

const S = 'mau-reseller-north';
const BASE = `http://127.0.0.1:${PORT}`;
const PROXY = 'http://localhost:3000/api/contentools/';

interface LogEntry {
  method: string;
  path: string;
  headers: Record<string, string>;
}
let child: ChildProcess | undefined;
const admin = (p: string, init?: RequestInit) => fetch(`${BASE}/__admin${p}`, init);
const log = async (): Promise<LogEntry[]> => (await (await admin('/requests')).json()) as LogEntry[];
const override = (o: object) => admin('/overrides', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const call = (handler: (r: Request, c: { params: Promise<{ path: string[] }> }) => Promise<Response>, p: string, init: RequestInit = {}) =>
  handler(new Request(PROXY + p, init), { params: Promise.resolve({ path: p.split('?')[0].split('/') }) });
const QUERY = JSON.stringify({ query: 'slug = "/home"' });
const JSON_HEADERS = { 'content-type': 'application/json' };

describe.skipIf(!existsSync(path.join(FAKE_DIR, 'node_modules/tsx/dist/cli.mjs')))('Storefront Contentools proxy attacks (fake Contentools, request log)', () => {
  beforeAll(async () => {
    child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/main.ts'], { cwd: FAKE_DIR, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', JWT_MODE: 'jwt' }, stdio: 'ignore' });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await admin('/health')).ok) return;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('fake-contentools did not start');
  }, 15_000);
  afterAll(() => {
    child?.kill('SIGTERM');
  });
  beforeEach(async () => {
    await admin('/reset', { method: 'POST' });
    await fetch(`${BASE}/__log`, { method: 'DELETE' });
  });

  it('D09 and D11: every write method is 404 and nothing reaches the upstream (also the portal-only routes)', async () => {
    for (const [handler, method] of [[route.POST, 'POST'], [route.PUT, 'PUT'], [route.PATCH, 'PATCH'], [route.DELETE, 'DELETE']] as const) {
      for (const p of [`service/${S}/configuration/theme`, `service/${S}/puck-pages`, `service/${S}/upload-file`, `service/${S}/puck-pages/x`]) {
        expect((await call(handler, p, { method, body: '{}', headers: JSON_HEADERS })).status, `${method} ${p}`).toBe(404);
      }
    }
    expect((await call(route.OPTIONS, `service/${S}/configuration/theme`, { method: 'OPTIONS' })).status).toBe(404);
    expect(await log()).toEqual([]);
  });

  it('D03 to D05 and D08: traversal, encodings, outside the allow-list are 404, nothing reaches the upstream', async () => {
    for (const p of [`service/${S}/..%2fx/configuration/theme`, `service/${S}/%252e%252e/configuration/theme`, `service/${S}%5cx/configuration/theme`, `service//${S}/configuration/theme`, `Service/${S}/configuration/theme`, `service/${S}/configuration/theme/`, `service/${S}/health`, 'service/refresh-jwt', `service/${S}/custom-objects`, `service/${S}/configuration/header`, 'service/proxy-script']) {
      expect(await call(route.GET, p).then((r) => r.status), p).toBe(404);
    }
    expect(await log()).toEqual([]);
  });

  it('D07 and E09: a read carries only the proxy project key; the visitor cookie, Authorization, x-forwarded-* and a method override never leave, and no authorization is ever sent', async () => {
    const res = await call(route.GET, `service/${S}/configuration/theme`, {
      headers: { authorization: 'Bearer attacker', 'x-project-key': 'other-project', cookie: 'malva_session=stolen', 'x-forwarded-host': 'evil.test', 'x-forwarded-for': '6.6.6.6', 'x-http-method-override': 'DELETE', 'x-store-key': 'mau-reseller-south', accept: 'application/json' },
    });
    expect(res.status).toBe(200);
    const [entry] = await log();
    expect(entry.method).toBe('GET');
    expect(entry.headers['x-project-key']).toBe('spec-test-attack');
    for (const name of ['authorization', 'cookie', 'x-forwarded-host', 'x-forwarded-for', 'x-http-method-override', 'x-store-key']) expect(entry.headers[name], name).toBeUndefined();
    expect(JSON.stringify(entry.headers)).not.toMatch(/attacker|stolen|evil\.test|other-project/);
  });

  it('D09: the published page query POST is the only POST; it is forwarded as a read (no authorization)', async () => {
    const res = await call(route.POST, `service/${S}/published/puck-pages/query`, { method: 'POST', body: QUERY, headers: { ...JSON_HEADERS, authorization: 'Bearer attacker' } });
    expect(res.status).toBe(200);
    const entries = await log();
    expect(entries.map((e) => `${e.method} ${e.path}`)).toEqual([`POST /service/${S}/published/puck-pages/query`]);
    expect(entries[0].headers.authorization).toBeUndefined();
  });

  it('D12: an upstream redirect to the metadata address is 502, never handed on, no Location header', async () => {
    await override({ method: 'GET', pathPrefix: `/service/${S}/configuration/theme`, status: 302, headers: { Location: 'http://169.254.169.254/' } });
    const res = await call(route.GET, `service/${S}/configuration/theme`);
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UPSTREAM_ERROR');
  });

  it('D13: an upstream 500 that echoes the received headers is replaced by UPSTREAM_ERROR; set-cookie and www-authenticate are dropped', async () => {
    await override({ method: 'GET', pathPrefix: `/service/${S}/configuration/theme`, status: 500, echoRequestHeaders: true, times: 1 });
    const res = await call(route.GET, `service/${S}/configuration/theme`, { headers: { cookie: 'malva_session=stolen' } });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/stolen|x-project-key/);
    await override({ method: 'GET', pathPrefix: `/service/${S}/configuration/theme`, status: 200, headers: { 'Set-Cookie': 'a=1', 'WWW-Authenticate': 'Bearer' }, body: { ok: true } });
    const ok = await call(route.GET, `service/${S}/configuration/theme`);
    expect(ok.headers.get('set-cookie')).toBeNull();
    expect(ok.headers.get('www-authenticate')).toBeNull();
  });

  it('D14: a body over 16 KB on the query POST is 413 before the upstream', async () => {
    const res = await call(route.POST, `service/${S}/published/puck-pages/query`, { method: 'POST', body: JSON.stringify({ query: 'x'.repeat(20_000) }), headers: JSON_HEADERS });
    expect(res.status).toBe(413);
    expect(await log()).toEqual([]);
  });
});
