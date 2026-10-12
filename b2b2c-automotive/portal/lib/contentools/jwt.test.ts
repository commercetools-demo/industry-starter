// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const post = vi.fn();
const get = vi.fn();
vi.mock('@/lib/ct/admin-client', () => ({
  adminRoot: {
    customObjects: () => ({
      withContainerAndKey: (args: unknown) => ({ get: () => ({ execute: () => get(args) }) }),
      post: (args: unknown) => ({ execute: () => post(args) }),
    }),
  },
}));

import { isJwtValid, resolveContentoolsJwt } from './jwt';

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const token = (expSeconds: number) => {
  const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${part({ alg: 'none' })}.${part({ sub: 'x', exp: expSeconds })}.sig`;
};
const valid = token(Math.floor(NOW / 1000) + 3600);
const expired = token(Math.floor(NOW / 1000) - 10);
const fresh = token(Math.floor(NOW / 1000) + 7200);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  get.mockReset();
  post.mockReset();
  execute.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('isJwtValid', () => {
  it('needs three parts and an exp more than 60 seconds ahead', () => {
    expect(isJwtValid(valid, NOW)).toBe(true);
    expect(isJwtValid(expired, NOW)).toBe(false);
    expect(isJwtValid(token(Math.floor(NOW / 1000) + 30), NOW)).toBe(false);
    expect(isJwtValid(null, NOW)).toBe(false);
    expect(isJwtValid('not-a-jwt', NOW)).toBe(false);
  });
});

describe('resolveContentoolsJwt', () => {
  it('valid token is returned without a refresh call', async () => {
    get.mockResolvedValue({ body: { value: valid, version: 3 } });
    expect(await resolveContentoolsJwt()).toBe(valid);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('absent object returns null and does not refresh', async () => {
    get.mockRejectedValue({ statusCode: 404 });
    expect(await resolveContentoolsJwt()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('expired token refreshed via /service/refresh-jwt with Bearer old token, new token persisted with the current version, returned in the same call', async () => {
    get.mockResolvedValue({ body: { value: expired, version: 7 } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: fresh }), { status: 200 }));
    post.mockResolvedValue({ body: {} });
    expect(await resolveContentoolsJwt()).toBe(fresh);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://contentools.example.test/service/refresh-jwt');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${expired}`);
    expect(post).toHaveBeenCalledWith({ body: { container: 'contentools-configuration', key: 'contentools-jwt-token', value: fresh, version: 7 } });
  });

  it('refresh failure returns null and never throws; token never logged', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'info')].map((s) => s.mockImplementation(() => undefined));
    get.mockResolvedValue({ body: { value: expired, version: 1 } });
    fetchMock.mockRejectedValue(new Error(`boom ${expired}`));
    expect(await resolveContentoolsJwt()).toBeNull();
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    expect(await resolveContentoolsJwt()).toBeNull();
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(expired);
      spy.mockRestore();
    }
  });

  it('a refreshed token that is itself expired is refused', async () => {
    get.mockResolvedValue({ body: { value: expired, version: 1 } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: expired }), { status: 200 }));
    expect(await resolveContentoolsJwt()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
});
