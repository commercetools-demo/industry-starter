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

const clientIds = () => calls.builders.map((b) => (b.auth as { credentials: { clientId: string } }).credentials.clientId);

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

  it('Client credentials flow points at the configured hosts', async () => {
    const { createApiRoot } = await import('./client');
    createApiRoot({ projectKey: 'p', authUrl: 'https://auth.example.test', apiUrl: 'https://api.example.test', clientId: 'cid', clientSecret: 'cs', scopes: ['view_stores'] });
    const log = calls.builders.at(-1)!;
    expect(log.http).toEqual({ host: 'https://api.example.test' });
    expect(log.auth).toMatchObject({ host: 'https://auth.example.test', projectKey: 'p', credentials: { clientId: 'cid', clientSecret: 'cs' } });
  });
});

describe('As-associate for buying, admin client for selling', () => {
  it('Admin and frontend use different credentials', async () => {
    await import('./client');
    await import('./admin-client');
    expect(calls.builders).toHaveLength(2);
    const [frontend, admin] = clientIds();
    expect(frontend).toBe('test-client-id');
    expect(admin).toBe('test-admin-client-id');
    expect(frontend).not.toBe(admin);
    expect((calls.builders[1].auth as { scopes: string[] }).scopes).toEqual(['manage_key_value_documents']);
  });

  it('Admin client names its own missing variable', async () => {
    vi.stubEnv('CTP_ADMIN_CLIENT_SECRET', '');
    await expect(import('./admin-client')).rejects.toThrow('Missing environment variable CTP_ADMIN_CLIENT_SECRET');
  });

  it('Provisioning client throws when not configured', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CTP_PROVISION_CLIENT_ID', '');
    const { getProvisioningRoot } = await import('./provisioning-client');
    expect(() => getProvisioningRoot()).toThrow('Provisioning client is not configured');
  });

  it('Provisioning client is created once, lazily, with its own credentials', async () => {
    const { getProvisioningRoot } = await import('./provisioning-client');
    const builtBefore = calls.builders.length;
    const first = getProvisioningRoot();
    const second = getProvisioningRoot();
    expect(second).toBe(first);
    expect(calls.builders.length - builtBefore).toBe(1);
    expect(clientIds().at(-1)).toBe('test-provision-client-id');
  });

  it('Three credential sets share nothing', async () => {
    await import('./client');
    await import('./admin-client');
    const { getProvisioningRoot } = await import('./provisioning-client');
    getProvisioningRoot();
    expect(new Set(clientIds()).size).toBe(3);
    const secrets = calls.builders.map((b) => (b.auth as { credentials: { clientSecret: string } }).credentials.clientSecret);
    expect(new Set(secrets).size).toBe(3);
  });
});
