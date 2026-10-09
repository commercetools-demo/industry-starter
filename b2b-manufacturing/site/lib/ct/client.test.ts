import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { apiRoot, provisioningRoot } from './client';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  if (['node_modules', '.next', '.git'].includes(f)) return [];
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe('malva-bff-and-session › Singleton', () => {
  it('`new ClientBuilder(` occurs only in lib/ct/client.ts', () => {
    const root = process.cwd();
    const hits = walk(root).filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !/\.test\./.test(f)).filter((f) => readFileSync(f, 'utf8').includes('new ClientBuilder(')).map((f) => path.relative(root, f));
    expect(hits).toEqual(['lib/ct/client.ts']);
  });
});

describe('malva-bff-and-session › Missing configuration', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it('names the missing variable on first use, not an authentication error', () => {
    delete process.env.CTP_PROJECT_KEY;
    expect(() => apiRoot.get()).toThrow(/Missing environment variable CTP_PROJECT_KEY/);
  });
  it('the provisioning client names its own variables', () => {
    delete process.env.CTP_PROV_CLIENT_ID;
    process.env.CTP_PROJECT_KEY = 'p'; process.env.CTP_AUTH_URL = 'https://a'; process.env.CTP_API_URL = 'https://b';
    expect(() => provisioningRoot.get()).toThrow(/CTP_PROV_CLIENT_ID/);
  });
  it('builds nothing at import time (no environment needed to load the module)', () => {
    expect(typeof apiRoot).toBe('object');
  });
});
