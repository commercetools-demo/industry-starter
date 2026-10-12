// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from './contentools-theme.mjs';

const SECRET = 'client-secret-xyz';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (exp) => `${b64({ alg: 'none' })}.${b64({ sub: 'proj', exp })}.sig-canary`;
const FUTURE = Math.floor(Date.now() / 1000) + 3600;

let servers = [];
const listen = (handler) =>
  new Promise((resolve) => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, headers: req.headers, body });
        handler(req, res, body, calls);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolve({ url: `http://127.0.0.1:${server.address().port}`, calls });
    });
  });

let dir;
let out;
let err;
const io = (extra = {}) => ({ stdout: (s) => out.push(s), stderr: (s) => err.push(s), ...extra });
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function setup({ token = jwt(FUTURE), tokenStatus = 200, postStatus = 201 } = {}) {
  const ct = await listen((req, res) => {
    if (req.url === '/oauth/token') return json(res, 200, { access_token: 'ct-access' });
    if (req.url.includes('contentools-jwt-token')) return tokenStatus === 404 ? json(res, 404, { message: 'not found' }) : json(res, 200, { value: token });
    return json(res, 500, {});
  });
  const cms = await listen((req, res, body, calls) => {
    if (req.method === 'POST' && calls.filter((c) => c.method === 'POST').length === 1 && postStatus !== 201) return json(res, postStatus, { message: 'exists' });
    if (req.method === 'GET') return json(res, 200, { colorPrimary: '#1f6f43' });
    return json(res, req.method === 'POST' ? 201 : 200, { ok: true });
  });
  writeFileSync(path.join(dir, 'seed.env'), `SEED_CTP_PROJECT_KEY=proj\nSEED_CTP_AUTH_URL=${ct.url}\nSEED_CTP_API_URL=${ct.url}\nSEED_CTP_CLIENT_ID=client-id\nSEED_CTP_CLIENT_SECRET=${SECRET}\n`);
  writeFileSync(path.join(dir, 'local.env'), `CONTENTOOLS_ORIGIN=${cms.url}/\n`);
  writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ colorPrimary: '#1f6f43' }));
  return { ct, cms, files: { seedEnvFile: path.join(dir, 'seed.env'), localEnvFile: path.join(dir, 'local.env') }, themeFile: path.join(dir, 'theme.json') };
}

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'contentools-theme-'));
  out = [];
  err = [];
});
afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  servers = [];
});

const everything = () => [...out, ...err].join('\n');

describe('One theme per reseller store: publish script', () => {
  it('Refuses stores that are not default or qa-*', async () => {
    const { cms, ct, files, themeFile } = await setup();
    for (const command of ['put', 'delete']) {
      const code = await run([command, '--store', 'mau-reseller-north', '--file', themeFile], io(files));
      expect(code).toBe(64);
    }
    expect(err.join('\n')).toContain('only "default" and "qa-*"');
    expect(cms.calls).toHaveLength(0);
    expect(ct.calls).toHaveLength(0);
  });
  it('Missing JWT custom object exits 2 and prints no token', async () => {
    const { files, themeFile } = await setup({ tokenStatus: 404 });
    const code = await run(['put', '--store', 'qa-green', '--file', themeFile], io(files));
    expect(code).toBe(2);
    expect(err.join('\n')).toContain('Contentools is not connected (OA-02)');
    expect(everything()).not.toContain(SECRET);
    expect(everything()).not.toContain('sig-canary');
  });
  it('Expired token exits 2', async () => {
    const { cms, files, themeFile } = await setup({ token: jwt(Math.floor(Date.now() / 1000) - 60) });
    const code = await run(['put', '--store', 'qa-green', '--file', themeFile], io(files));
    expect(code).toBe(2);
    expect(err.join('\n')).toContain('Token expired: open the Contentools Merchant Center app once');
    expect(cms.calls).toHaveLength(0);
    expect(everything()).not.toContain('sig-canary');
  });
  it('Put creates through POST with the bearer token and project key', async () => {
    const { cms, files, themeFile } = await setup();
    const code = await run(['put', '--store', 'qa-green', '--file', themeFile], io(files));
    expect(code).toBe(0);
    expect(cms.calls).toHaveLength(1);
    expect(cms.calls[0].method).toBe('POST');
    expect(cms.calls[0].url).toBe('/service/qa-green/configuration/theme');
    expect(cms.calls[0].headers.authorization).toMatch(/^Bearer .+\.sig-canary$/);
    expect(cms.calls[0].headers['x-project-key']).toBe('proj');
    expect(JSON.parse(cms.calls[0].body)).toEqual({ value: { colorPrimary: '#1f6f43' } });
  });
  it('Put falls back to PUT when POST says it exists', async () => {
    const { cms, files, themeFile } = await setup({ postStatus: 409 });
    const code = await run(['put', '--store', 'default', '--file', themeFile], io(files));
    expect(code).toBe(0);
    expect(cms.calls.map((c) => c.method)).toEqual(['POST', 'PUT']);
  });
  it('Delete sends DELETE', async () => {
    const { cms, files } = await setup();
    expect(await run(['delete', '--store', 'qa-navy'], io(files))).toBe(0);
    expect(cms.calls[0].method).toBe('DELETE');
  });
  it('Output never contains the token or the client secret', async () => {
    const { files, themeFile } = await setup();
    await run(['put', '--store', 'qa-green', '--file', themeFile], io(files));
    await run(['delete', '--store', 'qa-green'], io(files));
    await run(['get', '--store', 'qa-green'], io(files));
    expect(everything()).not.toContain(SECRET);
    expect(everything()).not.toContain('sig-canary');
    expect(everything()).not.toContain('ct-access');
  });
  it('Get needs no token', async () => {
    const { cms, ct, files } = await setup({ tokenStatus: 404 });
    const code = await run(['get', '--store', 'mau-reseller-north'], io(files));
    expect(code).toBe(0);
    expect(ct.calls).toHaveLength(0);
    expect(cms.calls).toHaveLength(1);
    expect(cms.calls[0].headers.authorization).toBeUndefined();
    expect(cms.calls[0].headers['x-project-key']).toBe('proj');
    expect(out.join('')).toContain('#1f6f43');
  });
});
