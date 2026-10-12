// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
//
// Test-only features of the fake (not in the real service): request log, failure injection, scripted overrides, stub.
import { describe, expect, it } from 'vitest';
import { startFakeContentools } from '../src/server.ts';
import { bearer, NORTH, projectHeader, useFake } from './helpers.ts';

const api = useFake();
const theme = `/service/${NORTH}/configuration/theme`;

describe('request log', () => {
  it('records method, url, headers (cookie and authorization included) and body, not admin calls', async () => {
    await api.call('GET', theme, { headers: { ...projectHeader, cookie: 'session=abc', 'x-source': 'storefront-test' } });
    await api.call('PUT', theme, { headers: bearer(), json: { value: { colorPrimary: '#222222' } } });
    const r = await api.call('GET', '/__admin/requests');
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(2);
    expect(r.body[0]).toMatchObject({ method: 'GET', path: theme, status: 200, handledBy: 'route' });
    expect(r.body[0].headers['x-project-key']).toBe('spec-test-b2b2c-automotive');
    expect(r.body[0].headers.cookie).toBe('session=abc');
    expect(r.body[1].headers.authorization).toMatch(/^Bearer /);
    expect(r.body[1].body).toEqual({ value: { colorPrimary: '#222222' } });
  });

  it('lets a test assert that the proxy stripped cookie and authorization', async () => {
    await api.call('GET', theme, { headers: projectHeader });
    const [entry] = (await api.call('GET', '/__admin/requests')).body;
    expect(entry.headers.cookie).toBeUndefined();
    expect(entry.headers.authorization).toBeUndefined();
    expect(entry.path).toBe(theme);
  });

  it('logs failed and unrouted requests with their status', async () => {
    await api.call('GET', '/service/nothing/here');
    await api.call('GET', theme); // no project key
    const log = (await api.call('GET', '/__admin/requests')).body;
    expect(log.map((e: { status: number }) => e.status)).toEqual([404, 400]);
  });

  it('filters by method, path and since; DELETE clears; /__log is an alias', async () => {
    await api.call('GET', theme, { headers: projectHeader });
    await api.call('PUT', theme, { headers: bearer(), json: { value: { a: 1 } } });
    expect((await api.call('GET', '/__admin/requests?method=PUT')).body).toHaveLength(1);
    expect((await api.call('GET', '/__admin/requests?path=configuration')).body).toHaveLength(2);
    const firstId = (await api.call('GET', '/__admin/requests')).body[0].id;
    expect((await api.call('GET', `/__admin/requests?since=${firstId}`)).body).toHaveLength(1);
    expect((await api.call('GET', '/__log')).body).toHaveLength(2);
    expect((await api.call('DELETE', '/__log')).status).toBe(204);
    expect((await api.call('GET', '/__admin/requests')).body).toEqual([]);
  });

  it('logs multipart uploads by metadata, not by content', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'x.png');
    await api.call('POST', `/service/${NORTH}/upload-file`, { headers: bearer(), body: fd });
    const [entry] = (await api.call('GET', '/__admin/requests')).body;
    expect(entry.body).toMatchObject({ multipart: true, files: [{ field: 'file', name: 'x.png', type: 'image/png', size: 3 }] });
  });
});

describe('failure modes (POST /__admin/fail)', () => {
  const set = (body: unknown) => api.call('POST', '/__admin/fail', { json: body });

  it('500: every request answers 500 { message: "Internal server error" }', async () => {
    await set({ mode: '500' });
    const r = await api.call('GET', theme, { headers: projectHeader });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ message: 'Internal server error' });
    expect((await api.call('GET', '/__admin/requests')).body[0].handledBy).toBe('fail:500');
  });

  it('a custom status such as 502 is possible', async () => {
    await set({ mode: '500', status: 502 });
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(502);
  });

  it('slow: delays then answers normally', async () => {
    await set({ mode: 'slow', delayMs: 300 });
    const t0 = Date.now();
    const r = await api.call('GET', theme, { headers: projectHeader });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(280);
    expect(r.status).toBe(200);
  });

  it('theme-down: only the theme read answers 503, everything else works', async () => {
    await set({ mode: 'theme-down' });
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(503);
    const page = await api.call('POST', `/service/${NORTH}/published/puck-pages/query`, { headers: projectHeader, json: { query: 'slug = "/home"' } });
    expect(page.status).toBe(200);
    // theme writes are not affected either
    expect((await api.call('PUT', theme, { headers: bearer(), json: { value: { a: 1 } } })).status).toBe(200);
  });

  it('theme-slow and theme-500 only touch the theme read', async () => {
    await set({ mode: 'theme-500' });
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(500);
    expect((await api.call('GET', `/service/${NORTH}/puck-pages`, { headers: projectHeader })).status).toBe(200);
    await set({ mode: 'theme-slow', delayMs: 250 });
    const t0 = Date.now();
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(200);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(230);
  });

  it('drop: the connection is destroyed (client sees a network error) and the request is still logged', async () => {
    await set({ mode: 'drop' });
    await expect(api.call('GET', theme, { headers: projectHeader })).rejects.toThrow();
    const log = (await api.call('GET', '/__admin/requests')).body;
    expect(log[0]).toMatchObject({ handledBy: 'fail:drop', status: null });
  });

  it('times limits how many requests fail, then the service recovers', async () => {
    await set({ mode: '500', times: 2 });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await api.call('GET', theme, { headers: projectHeader })).status);
    expect(statuses).toEqual([500, 500, 200]);
    expect((await api.call('GET', '/__admin/fail')).body.mode).toBe('none');
  });

  it('DELETE /__admin/fail restores normal behaviour; admin routes keep working while failing', async () => {
    await set({ mode: '500' });
    expect((await api.call('GET', '/__admin/fail')).body.mode).toBe('500');
    expect((await api.call('DELETE', '/__admin/fail')).status).toBe(200);
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(200);
  });

  it('rejects an unknown mode with 400', async () => {
    const r = await set({ mode: 'explode' });
    expect(r.status).toBe(400);
  });

  it('FAIL_MODE from the environment is the starting mode and survives /__admin/reset', async () => {
    const f = await startFakeContentools({ port: 0, fail: { mode: 'theme-down', delayMs: 0, status: 500, times: null } });
    try {
      expect((await fetch(`${f.url}${theme}`, { headers: projectHeader })).status).toBe(503);
      await fetch(`${f.url}/__admin/fail`, { method: 'DELETE' });
      expect((await fetch(`${f.url}${theme}`, { headers: projectHeader })).status).toBe(200);
      await fetch(`${f.url}/__admin/reset`, { method: 'POST' });
      expect((await fetch(`${f.url}${theme}`, { headers: projectHeader })).status).toBe(503);
    } finally {
      await f.close();
    }
  });
});

describe('overrides (POST /__admin/overrides)', () => {
  it('redirect: a 302 with Location passes through unchanged (X D12)', async () => {
    await api.call('POST', '/__admin/overrides', { json: { pathPrefix: '/service/redirect-me', status: 302, headers: { location: 'http://169.254.169.254/' } } });
    const res = await fetch(`${api.fake().url}/service/redirect-me/configuration/theme`, { redirect: 'manual', headers: projectHeader });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://169.254.169.254/');
  });

  it('echo: a 500 whose body contains the received headers (X D13)', async () => {
    await api.call('POST', '/__admin/overrides', { json: { pathPrefix: '/service/echo', status: 500, echoRequestHeaders: true } });
    const r = await api.call('GET', '/service/echo/configuration/theme', { headers: { authorization: 'Bearer leak-me', ...projectHeader } });
    expect(r.status).toBe(500);
    expect(r.body.receivedHeaders.authorization).toBe('Bearer leak-me');
  });

  it('times and method matching; DELETE clears', async () => {
    await api.call('POST', '/__admin/overrides', { json: { method: 'GET', pathRegex: 'configuration/theme', status: 418, body: { message: 'teapot' }, times: 1 } });
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(418);
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(200);
    await api.call('POST', '/__admin/overrides', { json: { pathPrefix: '/service', status: 418 } });
    expect((await api.call('DELETE', '/__admin/overrides')).status).toBe(204);
    expect((await api.call('GET', theme, { headers: projectHeader })).status).toBe(200);
  });
});

describe('reset and state', () => {
  it('reset restores the fixture, clears the log, uploads and overrides', async () => {
    await api.call('PUT', theme, { headers: bearer(), json: { value: { colorPrimary: '#999999' } } });
    await api.call('POST', '/__admin/reset');
    const r = await api.call('GET', theme, { headers: projectHeader });
    expect(r.body.colorPrimary).toBe('#1d3b78');
    expect((await api.call('GET', '/__admin/requests')).body).toHaveLength(1);
  });

  it('GET /__admin/state lists custom object keys per container', async () => {
    const r = await api.call('GET', '/__admin/state');
    expect(r.body.objects.configuration).toEqual(['default-theme', 'mau-reseller-north-theme', 'mau-reseller-south-theme']);
    expect(r.body.objects['puck-page']).toContain('puck-page-north-home');
  });
});

describe('stub mode (record only, X-06)', () => {
  it('answers 200 JSON to any path and method and records everything, no auth needed', async () => {
    const f = await startFakeContentools({ port: 0, stubMode: true });
    try {
      const res = await fetch(`${f.url}/anything/at/all?x=1`, { method: 'DELETE', headers: { cookie: 'c=1', authorization: 'Bearer t' } });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ stub: true });
      const log = (await (await fetch(`${f.url}/__log`)).json()) as Array<{ handledBy: string; headers: Record<string, string>; url: string }>;
      expect(log[0]).toMatchObject({ handledBy: 'stub', url: '/anything/at/all?x=1' });
      expect(log[0]?.headers.cookie).toBe('c=1');
    } finally {
      await f.close();
    }
  });
});
