import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanAll, scanBundle, scanDevRoutes, scanSecretValues, scanSourceMaps } from './check-bundle.mjs';
import { pruneDevRoutes } from './prune-dev-routes.mjs';

let root: string;
const env = (vars: Record<string, string>): NodeJS.ProcessEnv => ({ NODE_ENV: 'test', ...vars });
const put = (rel: string, text = '') => {
  const path = join(root, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bundle-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('production-build checks (Y-04)', () => {
  it('a clean build passes', () => {
    put('.next/static/chunks/a.js', 'console.log("hello")');
    put('.next/server/app/[locale]/page.js', 'x');
    expect(scanAll(root, env({ NETLIFY: 'true' }))).toEqual([]);
  });

  it('a secret variable name in the client bundle fails', () => {
    put('.next/static/chunks/a.js', 'const a = "CTP_CLIENT_SECRET"');
    expect(scanBundle(root)).toHaveLength(1);
  });

  it('a secret VALUE in the client bundle or server output fails, naming the variable but not the value', () => {
    put('.next/static/chunks/a.js', 'const k = "s3cr3t-value-123"');
    put('.next/server/chunks/b.js', 'const k = "another-secret-456"');
    const problems = scanSecretValues(root, env({ CTP_CLIENT_SECRET: 's3cr3t-value-123', RETENTION_SECRET: 'another-secret-456', SESSION_SECRET: 'short' }));
    expect(problems).toHaveLength(2);
    expect(problems.join(' ')).toContain('CTP_CLIENT_SECRET');
    expect(problems.join(' ')).not.toContain('s3cr3t-value-123');
  });

  it('a source map in the public bundle fails', () => {
    put('.next/static/chunks/a.js.map', '{}');
    expect(scanSourceMaps(root)).toHaveLength(1);
  });

  it('release build: health route, _tokens and _boom must be absent from the compiled output', () => {
    put('.next/server/app/api/health/route.js');
    put('.next/server/app/[locale]/_tokens/page.js');
    put('.next/server/app/[locale]/_boom/page.js');
    expect(scanDevRoutes(root, true)).toHaveLength(3);
    expect(scanDevRoutes(root, false)).toEqual([]);
  });
});

describe('prune-dev-routes', () => {
  it('removes the dev-only routes on a release build and does nothing otherwise', () => {
    put('app/api/health/route.ts');
    put('app/[locale]/%5Ftokens/page.tsx');
    put('app/[locale]/%5Fboom/page.tsx');
    put('app/api/cart/route.ts');
    expect(pruneDevRoutes(root, env({}))).toEqual([]);
    expect(pruneDevRoutes(root, env({ NETLIFY: 'true' }))).toHaveLength(3);
    expect(pruneDevRoutes(root, env({ NETLIFY: 'true' }))).toEqual([]);
  });
});
