// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X, attack group D (Contentools proxy) and group E (JWT leakage) against the REAL route handler and the REAL fake
// Contentools server (tools/fake-contentools, started as a child process on a free port, no commercetools call). The proof of
// every row is the fake's own request log (`GET /__admin/requests`): what reached the upstream hop, with which headers.
// Skipped when the fake is not checked out next to the portal.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { sessionFor } from '@/lib/authz/test-helpers';
import type { Session } from '@/lib/types';

const FAKE_DIR = path.resolve(import.meta.dirname, '../../../../../tools/fake-contentools');
const PORT = vi.hoisted(() => 41000 + Math.floor(Math.random() * 8000));
vi.hoisted(() => {
  process.env.CONTENTOOLS_ORIGIN = `http://127.0.0.1:${PORT}`;
  process.env.CTP_PROJECT_KEY = 'spec-test-attack';
});

const CANARY = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9.CANARY-SIGNATURE-0123456789';
let session: Session = {};
let role: 'admin' | 'buyer' = 'admin';
vi.mock('@/lib/portal/seam', () => ({ readSession: async () => session }));
vi.mock('@/lib/authz/authorize-store', () => ({
  authorizeStore: async () => {
    if (role !== 'admin') throw new ApiError(403, 'Forbidden');
  },
}));
vi.mock('@/lib/contentools/jwt', () => ({ getValidContentoolsJwt: async () => CANARY }));

import * as route from './route';

const S = 'store-a';
const B = 'store-b';
const BASE = `http://127.0.0.1:${PORT}`;
const PROXY = 'http://localhost:3001/api/contentools/';

interface LogEntry {
  method: string;
  path: string;
  url: string;
  headers: Record<string, string>;
  status: number | null;
}
let child: ChildProcess | undefined;
const admin = (p: string, init?: RequestInit) => fetch(`${BASE}/__admin${p}`, init);
const log = async (): Promise<LogEntry[]> => (await (await admin('/requests')).json()) as LogEntry[];
const reset = async () => {
  await admin('/reset', { method: 'POST' });
  await fetch(`${BASE}/__log`, { method: 'DELETE' });
  await admin('/overrides', { method: 'DELETE' });
};
const call = (handler: (r: Request) => Promise<Response>, p: string, init: RequestInit & { json?: unknown } = {}) => {
  const { json, ...rest } = init;
  return handler(new Request(PROXY + p, { ...rest, ...(json !== undefined ? { body: JSON.stringify(json), headers: { 'content-type': 'application/json', ...(rest.headers as Record<string, string>) } } : {}) }));
};
const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3])], { type: 'image/png' });
const upload = (file: Blob, name: string) => {
  const form = new FormData();
  form.set('file', file, name);
  return call(route.POST, `service/${S}/upload-file`, { method: 'POST', body: form });
};
const LEAK = /eyJhbGciOiJIUzI1NiJ9\.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9|CANARY-SIGNATURE/;
const texts = async (res: Response) => `${await res.text()}${JSON.stringify([...res.headers.entries()])}`;

describe.skipIf(!existsSync(path.join(FAKE_DIR, 'node_modules/tsx/dist/cli.mjs')))('Contentools proxy attacks (fake Contentools, request log)', () => {
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
    session = sessionFor('adminA');
    role = 'admin';
    vi.unstubAllEnvs();
    await reset();
  });

  it('D01: PUT theme of store B as the admin of store A is 403 PROXY_STORE_MISMATCH and the upstream log is empty', async () => {
    const res = await call(route.PUT, `service/${B}/configuration/theme`, { method: 'PUT', json: { value: { colorPrimary: '#ff0000' } } });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('PROXY_STORE_MISMATCH');
    expect(await log()).toEqual([]);
  });

  it('D02: rewrite mode (test only) forwards as store A; the upstream never sees store B', async () => {
    vi.stubEnv('PROXY_STRICT_STORE', 'false');
    const res = await call(route.PUT, `service/${B}/configuration/theme`, { method: 'PUT', json: { value: { colorPrimary: '#123456' } } });
    expect(res.status).toBe(200);
    const entries = await log();
    expect(entries.map((e) => e.path)).toEqual([`/service/${S}/configuration/theme`]);
    expect(JSON.stringify(entries)).not.toContain(B);
  });

  it('D03 and D04: traversal, double encoding, backslash, //, NUL, tab, unicode dots and overlong UTF-8 are refused with no upstream call', async () => {
    const paths = [
      `service/${S}/..%2f${B}/configuration/theme`,
      `service/${S}/%2e%2e/${B}/configuration/theme`,
      `service/${S}/%252e%252e/${B}/configuration/theme`,
      `service/${S}%5c${B}/configuration/theme`,
      `service//${S}/configuration/theme`,
      `service/${S}/configuration/theme%00`,
      `service/${S}/configuration/theme%09`,
      `service/${S}/%u002e%u002e/configuration/theme`,
      `service/${S}/%c0%ae%c0%ae/configuration/theme`,
      `service/${S}/../${B}/configuration/theme`,
    ];
    for (const p of paths) {
      const res = await call(route.GET, p);
      // The URL parser turns %2e%2e into a dot segment before the route runs, so that one lands on store B's path: 403.
      expect([400, 403, 404], p).toContain(res.status);
    }
    expect(await log()).toEqual([]);
  });

  it('D05 (note): a literal ../ is normalised by the URL parser before the route, so it can only reach another allowed path of the SAME store', async () => {
    const res = await call(route.GET, `service/${S}/configuration/theme/../../puck-pages`);
    expect(res.status).toBe(200);
    expect((await log()).map((e) => e.path)).toEqual([`/service/${S}/puck-pages`]);
  });

  it('D05: case and dot tricks are not on the allow-list', async () => {
    for (const p of [`Service/${S}/configuration/theme`, `service/${S}./configuration/theme`, `service/${S}/configuration/theme/`, `service/${S}/CONFIGURATION/theme`]) {
      expect([400, 404], p).toContain((await call(route.GET, p)).status);
    }
    expect(await log()).toEqual([]);
  });

  it('D06: store B in the query, in the JSON body or nested in a page save is 403 with no upstream call', async () => {
    expect((await call(route.GET, `service/${S}/puck-pages?businessUnitKey=${B}`)).status).toBe(403);
    expect((await call(route.POST, `service/${S}/puck-pages`, { method: 'POST', json: { value: { businessUnitKey: B } } })).status).toBe(403);
    expect((await call(route.POST, `service/${S}/puck-pages`, { method: 'POST', json: { value: { page: { storeKey: B } } } })).status).toBe(403);
    expect(await log()).toEqual([]);
  });

  it('D07: client Authorization, X-Project-Key, Cookie, X-Forwarded-Host and method override never reach the upstream; the JWT is on writes only', async () => {
    const evilHeaders = { authorization: 'Bearer attacker', 'x-project-key': 'other-project', cookie: 'malva_portal_session=stolen', 'x-forwarded-host': 'evil.test', 'x-http-method-override': 'DELETE', 'x-forwarded-for': '6.6.6.6' };
    expect((await call(route.GET, `service/${S}/configuration/theme`, { headers: evilHeaders })).status).toBe(200);
    expect((await call(route.PUT, `service/${S}/configuration/theme`, { method: 'PUT', json: { value: { colorPrimary: '#abcdef' } }, headers: evilHeaders })).status).toBe(200);
    const [read, write] = await log();
    expect(read.method).toBe('GET');
    expect(read.headers.authorization).toBeUndefined();
    expect(write.method).toBe('PUT');
    expect(write.headers.authorization).toBe(`Bearer ${CANARY}`);
    for (const e of [read, write]) {
      expect(e.headers['x-project-key']).toBe('spec-test-attack');
      for (const name of ['cookie', 'x-forwarded-host', 'x-http-method-override', 'x-forwarded-for']) expect(e.headers[name], name).toBeUndefined();
    }
    expect(JSON.stringify(await log())).not.toMatch(/attacker|stolen|evil\.test|other-project/);
  });

  it('D08: routes outside the allow-list (health, refresh-jwt, admin, custom-objects, absolute URL) are 404 with no upstream call', async () => {
    for (const p of [`service/${S}/health`, 'service/refresh-jwt', `service/${S}/admin/x`, `service/${S}/custom-objects`, 'http://169.254.169.254/', `service/${S}/configuration/header`]) {
      expect([400, 404], p).toContain((await call(route.GET, p)).status);
    }
    expect((await call(route.POST, 'service/refresh-jwt', { method: 'POST' })).status).toBe(404);
    expect(await log()).toEqual([]);
  });

  it('D10: no session is 401 and a Buyer is 403, both with an empty upstream log', async () => {
    session = {};
    expect((await call(route.GET, `service/${S}/configuration/theme`)).status).toBe(401);
    session = sessionFor('buyerA');
    role = 'buyer';
    expect((await call(route.GET, `service/${S}/configuration/theme`)).status).toBe(403);
    expect((await call(route.PUT, `service/${S}/configuration/theme`, { method: 'PUT', json: { value: {} } })).status).toBe(403);
    expect(await log()).toEqual([]);
  });

  it('D11: TRACE and CONNECT are not exported (Next answers 405); OPTIONS is a fixed 204 with no upstream call', async () => {
    expect((route as Record<string, unknown>).TRACE).toBeUndefined();
    expect((route as Record<string, unknown>).CONNECT).toBeUndefined();
    const res = await route.OPTIONS();
    expect(res.status).toBe(204);
    expect(await log()).toEqual([]);
  });

  it('D12: an upstream redirect to the metadata address is 502, never followed, and no Location header leaks', async () => {
    await admin('/overrides', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'GET', pathPrefix: `/service/${S}/configuration/theme`, status: 302, headers: { Location: 'http://169.254.169.254/' } }) });
    const res = await call(route.GET, `service/${S}/configuration/theme`);
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UPSTREAM_ERROR');
    expect((await log()).filter((e) => e.path.includes('169.254'))).toEqual([]);
  });

  it('D13 and E05: an upstream 500 that echoes the received Authorization header never reaches the client', async () => {
    await admin('/overrides', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'PUT', pathPrefix: `/service/${S}/configuration/theme`, status: 500, echoRequestHeaders: true }) });
    const res = await call(route.PUT, `service/${S}/configuration/theme`, { method: 'PUT', json: { value: {} } });
    expect(res.status).toBe(502);
    const out = await texts(res);
    expect(out).toContain('UPSTREAM_ERROR');
    expect(out).not.toMatch(LEAK);
    expect(out).not.toMatch(/authorization/i);
  });

  it('E03: even a 200 that reflects the Authorization header is replaced; set-cookie and hop headers from upstream are dropped', async () => {
    await admin('/overrides', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'PUT', pathPrefix: `/service/${S}/configuration/theme`, status: 200, echoRequestHeaders: true, times: 1 }) });
    const echoed = await call(route.PUT, `service/${S}/configuration/theme`, { method: 'PUT', json: { value: {} } });
    expect(await texts(echoed)).not.toMatch(LEAK);
    await admin('/overrides', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'GET', pathPrefix: `/service/${S}/configuration/theme`, status: 200, headers: { 'Set-Cookie': 'upstream=1', 'WWW-Authenticate': 'Bearer', 'Access-Control-Allow-Origin': 'http://evil.test' }, body: { ok: true } }) });
    const cookies = await call(route.GET, `service/${S}/configuration/theme`);
    expect(cookies.headers.get('set-cookie')).toBeNull();
    expect(cookies.headers.get('www-authenticate')).toBeNull();
    expect(cookies.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('E01 to E04: a normal editor session (read, save, upload) never shows the JWT to the client; the upstream sees it on writes only', async () => {
    const outputs = [
      await texts(await call(route.GET, `service/${S}/configuration/theme`)),
      await texts(await call(route.PUT, `service/${S}/configuration/theme`, { method: 'PUT', json: { value: { colorPrimary: '#112233' } } })),
      await texts(await upload(png(), 'logo.png')),
      await texts(await call(route.GET, `service/${S}/puck-pages`)),
    ];
    expect(outputs.join('\n')).not.toMatch(LEAK);
    const entries = await log();
    expect(entries.filter((e) => e.method === 'GET').every((e) => e.headers.authorization === undefined)).toBe(true);
    expect(entries.filter((e) => e.method !== 'GET').every((e) => e.headers.authorization === `Bearer ${CANARY}`)).toBe(true);
  });

  it('D14: oversized JSON and uploads, a non-JSON write and non-image uploads are refused before the upstream', async () => {
    const big = JSON.stringify({ value: 'x'.repeat(2 * 1024 * 1024 + 10) });
    expect((await call(route.PUT, `service/${S}/configuration/theme`, { method: 'PUT', body: big, headers: { 'content-type': 'application/json' } })).status).toBe(413);
    expect((await call(route.PUT, `service/${S}/configuration/theme`, { method: 'PUT', body: 'a=1', headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    const six = new Uint8Array(6 * 1024 * 1024);
    six.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await upload(new Blob([six], { type: 'image/png' }), 'big.png')).status).toBe(413);
    const bad: [Blob, string][] = [
      [new Blob(['<html><script>alert(1)</script></html>'], { type: 'text/html' }), 'x.html'],
      [new Blob([new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff])], { type: 'application/x-msdownload' }), 'x.exe'],
      [new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'x.svg'],
      [new Blob(['<html>not a png but says so</html>'], { type: 'image/png' }), 'fake.png'],
      [new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'image/png' }), 'jpeg-as-png.png'],
    ];
    for (const [file, name] of bad) expect((await upload(file, name)).status, name).toBe(415);
    expect(await log()).toEqual([]);
  });

  it('F11: a legitimate image upload goes through once, with the server JWT, and answers the stored URL', async () => {
    const res = await upload(png(), 'logo.png');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { url: string }).url).toContain('/__files/');
    expect((await log()).map((e) => `${e.method} ${e.path}`)).toEqual([`POST /service/${S}/upload-file`]);
  });
});
