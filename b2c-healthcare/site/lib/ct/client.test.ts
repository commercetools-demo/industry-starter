import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiRoot, getApiRoot, resetApiRootForTests } from './client';

const root = resolve(import.meta.dirname, '../..');
const SKIP = new Set(['node_modules', '.next', '.git', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

const ENV = {
  CTP_PROJECT_KEY: 'proj',
  CTP_AUTH_URL: 'https://auth.example.test',
  CTP_API_URL: 'https://api.example.test',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'test-not-a-secret',
  CTP_SCOPES: 'view_products:proj',
};
const saved = { ...process.env };

describe('storefront-bff-and-session: Single server-side commercetools client', () => {
  beforeEach(() => resetApiRootForTests());
  afterEach(() => {
    process.env = { ...saved };
    resetApiRootForTests();
  });

  it('Singleton: new ClientBuilder( occurs only in lib/ct/client.ts', () => {
    const hits = walk(root)
      .filter((f) => !/\.test\.tsx?$/.test(f) && !relative(root, f).startsWith('eslint/'))
      .filter((f) => readFileSync(f, 'utf8').includes('new ClientBuilder('))
      .map((f) => relative(root, f));
    expect(hits).toEqual(['lib/ct/client.ts']);
  });

  it('Singleton: repeated use returns the same instance', () => {
    Object.assign(process.env, ENV);
    expect(getApiRoot()).toBe(getApiRoot());
    expect(typeof apiRoot.get).toBe('function');
  });

  it('Missing configuration: first use throws naming the variable; import alone does not', () => {
    for (const k of Object.keys(ENV)) delete process.env[k];
    expect(() => getApiRoot()).toThrow('CTP_PROJECT_KEY');
    expect(() => apiRoot.get()).toThrow('CTP_PROJECT_KEY');
  });
});
