// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ builders: [] as Array<Record<string, unknown>> }));

vi.mock('@commercetools/ts-client', () => {
  class ClientBuilder {
    log: Record<string, unknown> = {};
    constructor() {
      calls.builders.push(this.log);
    }
    withProjectKey(key: string) {
      this.log.projectKey = key;
      return this;
    }
    withClientCredentialsFlow(o: unknown) {
      this.log.flow = 'clientCredentials';
      this.log.auth = o;
      return this;
    }
    withAnonymousSessionFlow(o: unknown) {
      this.log.flow = 'anonymous';
      this.log.auth = o;
      return this;
    }
    withPasswordFlow(o: unknown) {
      this.log.flow = 'password';
      this.log.auth = o;
      return this;
    }
    withHttpMiddleware(o: unknown) {
      this.log.http = o;
      return this;
    }
    build() {
      return { execute: vi.fn() };
    }
  }
  return { ClientBuilder };
});

const config = {
  projectKey: 'p',
  authUrl: 'https://auth.example.test',
  apiUrl: 'https://api.example.test',
  clientId: 'cid',
  clientSecret: 'csecret',
  scopes: ['view_stores', 'view_categories'],
};

beforeEach(() => {
  calls.builders.length = 0;
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe('BFF boundary: Single client', () => {
  it('Singleton', () => {
    const SKIP = new Set(['node_modules', '.next', '.git', 'coverage', 'fixtures']);
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        if (SKIP.has(f)) return [];
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });
    const hits = walk(process.cwd())
      .filter((f) => /\.tsx?$/.test(f) && !/\.(test|spec)\./.test(f))
      .filter((f) => readFileSync(f, 'utf8').includes('new ClientBuilder('))
      .map((f) => path.relative(process.cwd(), f).split(path.sep).join('/'));
    expect(hits).toEqual(['lib/ct/client.ts']);
  });

  it('Client builder receives split scopes', async () => {
    vi.stubEnv('CTP_SCOPES', 'view_stores   view_categories\nmanage_customers');
    await import('./client');
    const auth = calls.builders[0].auth as { scopes: string[] };
    expect(auth.scopes).toEqual(['view_stores', 'view_categories', 'manage_customers']);
    expect(calls.builders).toHaveLength(1);
  });

  it('Missing configuration names the variable', async () => {
    vi.stubEnv('CTP_PROJECT_KEY', '');
    await expect(import('./client')).rejects.toThrow('Missing environment variable CTP_PROJECT_KEY');
    expect(calls.builders).toHaveLength(0);
  });

  it('Client credentials flow is the default and points at the configured hosts', async () => {
    const { createApiRoot } = await import('./client');
    createApiRoot(config);
    const log = calls.builders.at(-1)!;
    expect(log.flow).toBe('clientCredentials');
    expect(log.http).toEqual({ host: 'https://api.example.test' });
    expect(log.auth).toMatchObject({ host: 'https://auth.example.test', projectKey: 'p', credentials: { clientId: 'cid', clientSecret: 'csecret' } });
  });

  it('Anonymous flow carries the anonymous id', async () => {
    const { createApiRoot } = await import('./client');
    createApiRoot(config, { kind: 'anonymous', anonymousId: 'anon-1' });
    expect(calls.builders.at(-1)!.flow).toBe('anonymous');
    expect(calls.builders.at(-1)!.auth).toMatchObject({ credentials: { anonymousId: 'anon-1' } });
  });

  it('Password flow carries the user credentials for one client only', async () => {
    const { createApiRoot } = await import('./client');
    createApiRoot(config, { kind: 'password', username: 'a@example.com', password: 'pw' });
    expect(calls.builders.at(-1)!.flow).toBe('password');
    expect(calls.builders.at(-1)!.auth).toMatchObject({ credentials: { user: { username: 'a@example.com', password: 'pw' } } });
  });

  it('In-store builder rejects keys that are not commercetools keys', async () => {
    vi.doMock('./client', () => ({
      apiRoot: { inStoreKeyWithStoreKeyValue: vi.fn(({ storeKey }: { storeKey: string }) => ({ storeKey })) },
    }));
    const { inStore } = await import('./in-store');
    expect(inStore('mau-store-north')).toEqual({ storeKey: 'mau-store-north' });
    expect(() => inStore('../etc')).toThrow('Invalid store key');
    expect(() => inStore('a')).toThrow('Invalid store key');
    vi.doUnmock('./client');
  });
});
