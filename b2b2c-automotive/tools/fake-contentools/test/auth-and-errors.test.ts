// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Mirrors middleware/jwt.middleware.ts, project-key.middleware.ts, project.middleware.ts, error.middleware.ts and
// app.ts (catch-all 404) of the real service.
import { describe, expect, it } from 'vitest';
import { bearer, makeJwt, NORTH, PROJECT, projectHeader, useFake } from './helpers.ts';

const api = useFake();
const write = { value: { colorPrimary: '#111111' } };
const url = `/service/${NORTH}/configuration/theme`;

describe('JWT on writes (signature is not verified by the fake)', () => {
  it('no Authorization header: 401 Authorization header missing', async () => {
    const r = await api.call('PUT', url, { json: write });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ message: 'Authorization header missing' });
  });

  it('not a Bearer scheme: 401 with the real message', async () => {
    const r = await api.call('PUT', url, { headers: { authorization: `Basic ${makeJwt()}` }, json: write });
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Invalid authorization format. Expected: Bearer <token>');
  });

  it('a bare "Bearer" without token is 401 (HTTP trims the trailing space, so it is the format error)', async () => {
    const r = await api.call('PUT', url, { headers: { authorization: 'Bearer' }, json: write });
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Invalid authorization format. Expected: Bearer <token>');
  });

  it('a malformed token is rejected in jwt mode', async () => {
    const r = await api.call('PUT', url, { headers: { authorization: 'Bearer not-a-jwt' }, json: write });
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/^Invalid JWT token/);
  });

  it('an expired token: 401 JWT token has expired', async () => {
    const r = await api.call('PUT', url, { headers: bearer({ sub: PROJECT, exp: Math.floor(Date.now() / 1000) - 60 }), json: write });
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('JWT token has expired');
  });

  it('a token without sub: 401 missing project key', async () => {
    const r = await api.call('PUT', url, { headers: bearer({ iss: 'multitenant-contentools' }), json: write });
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Invalid token: missing project key (sub claim)');
  });

  it('wrong issuer and audience are rejected', async () => {
    const iss = await api.call('PUT', url, { headers: bearer({ sub: PROJECT, iss: 'evil' }), json: write });
    expect(iss.body.message).toBe('Invalid token issuer');
    const aud = await api.call('PUT', url, { headers: bearer({ sub: PROJECT, aud: 'evil' }), json: write });
    expect(aud.body.message).toBe('Invalid token audience');
  });

  it('any well-formed token with a sub is accepted, including the X-12 canary shape', async () => {
    const canary = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9.CANARY-SIGNATURE-0123456789';
    const r = await api.call('PUT', url, { headers: { authorization: `Bearer ${canary}` }, json: write });
    expect(r.status).toBe(200);
  });
});

describe('x-project-key and project registration', () => {
  it('an unregistered project is 403 Project not found or not registered', async () => {
    const strict = await import('../src/server.ts').then((m) => m.startFakeContentools({ port: 0, projectKeys: [PROJECT] }));
    try {
      const r = await fetch(`${strict.url}${url}`, { headers: { 'x-project-key': 'someone-else' } });
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ message: 'Project not found or not registered' });
      const ok = await fetch(`${strict.url}${url}`, { headers: projectHeader });
      expect(ok.status).toBe(200);
      const jwt = await fetch(`${strict.url}${url}`, { method: 'PUT', headers: { ...bearer({ sub: 'someone-else' }), 'content-type': 'application/json' }, body: JSON.stringify(write) });
      expect(jwt.status).toBe(403);
    } finally {
      await strict.close();
    }
  });

  it('an inactive project is 403 Project is inactive', async () => {
    const f = await import('../src/server.ts').then((m) => m.startFakeContentools({ port: 0, inactiveProjectKeys: [PROJECT] }));
    try {
      const r = await fetch(`${f.url}${url}`, { headers: projectHeader });
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ message: 'Project is inactive' });
    } finally {
      await f.close();
    }
  });

  it('lenient jwt mode accepts any non-empty bearer token', async () => {
    const f = await import('../src/server.ts').then((m) => m.startFakeContentools({ port: 0, jwtMode: 'lenient' }));
    try {
      const r = await fetch(`${f.url}${url}`, { method: 'PUT', headers: { authorization: 'Bearer opaque', 'content-type': 'application/json' }, body: JSON.stringify(write) });
      expect(r.status).toBe(200);
      const none = await fetch(`${f.url}${url}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(write) });
      expect(none.status).toBe(401);
    } finally {
      await f.close();
    }
  });
});

describe('error shapes', () => {
  it('unknown path under /service: 404 { message: "Path not found." }', async () => {
    const r = await api.call('GET', '/service/nothing/here/at/all', { headers: projectHeader });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ message: 'Path not found.' });
  });

  it('unknown path outside /service: the same 404', async () => {
    const r = await api.call('GET', '/elsewhere');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ message: 'Path not found.' });
  });

  it('a known path with an unsupported method falls through to the 404', async () => {
    const r = await api.call('PATCH', url, { headers: { ...projectHeader, ...bearer() }, json: write });
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Path not found.');
  });

  it('malformed JSON body: 500 Internal server error (body-parser errors are not CustomErrors)', async () => {
    const r = await api.call('PUT', url, { headers: bearer(), rawJson: '{ nope' });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ message: 'Internal server error' });
  });

  it('JSON body over 100 kB: 500 as well (body-parser limit)', async () => {
    const r = await api.call('PUT', url, { headers: bearer(), json: { value: { big: 'x'.repeat(120 * 1024) } } });
    expect(r.status).toBe(500);
  });

  it('error bodies never contain a stack, the received headers or the token', async () => {
    const r = await api.call('PUT', url, { headers: { authorization: 'Bearer SECRET-TOKEN-VALUE' }, json: write });
    expect(r.text).not.toMatch(/SECRET-TOKEN-VALUE|stack/);
  });

  it('GET /service/health requires the project key and reports healthy', async () => {
    expect((await api.call('GET', '/service/health')).status).toBe(400);
    const r = await api.call('GET', '/service/health', { headers: projectHeader });
    expect(r.body).toMatchObject({ status: 'healthy', service: 'multitenant-contentools' });
  });

  it('POST refresh-jwt accepts an expired token and returns a new one', async () => {
    const expired = bearer({ sub: PROJECT, exp: Math.floor(Date.now() / 1000) - 3600 });
    const r = await api.call('POST', '/service/refresh-jwt', { headers: expired });
    expect(r.status).toBe(200);
    expect(r.body.projectKey).toBe(PROJECT);
    expect(r.body.token.split('.')).toHaveLength(3);
  });
});

describe('CORS', () => {
  it('reflects a localhost origin and answers the preflight', async () => {
    const f = api.fake();
    const res = await fetch(`${f.url}${url}`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'PUT' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-headers')).toMatch(/x-project-key/);
  });
});
