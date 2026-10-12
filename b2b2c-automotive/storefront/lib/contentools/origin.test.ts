// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) vi.stubEnv('CONTENTOOLS_ORIGIN', '');
  else vi.stubEnv('CONTENTOOLS_ORIGIN', value);
  return import('./origin');
}

afterEach(() => vi.unstubAllEnvs());

describe('Contentools reads and the same-origin proxy: origin module', () => {
  it('Trailing slash is trimmed', async () => {
    expect((await load('https://cms.example.com/')).CONTENTOOLS_ORIGIN).toBe('https://cms.example.com');
  });
  it('Several trailing slashes are trimmed', async () => {
    expect((await load('https://cms.example.com///')).CONTENTOOLS_ORIGIN).toBe('https://cms.example.com');
  });
  it('Missing variable gives an empty origin, never a default URL', async () => {
    expect((await load(undefined)).CONTENTOOLS_ORIGIN).toBe('');
  });
  it('Proxy base is fixed', async () => {
    expect((await load('https://x.example.com')).CONTENTOOLS_PROXY_BASE).toBe('/api/contentools/service');
  });
  it('Only origin.ts reads the variable', () => {
    const root = path.resolve(import.meta.dirname, '../..');
    // lib/env.ts validates by name (env[name]); only origin.ts may read the property. Importers use the exported constant.
    const allowed = new Set(['lib/contentools/origin.ts']);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', '.git', 'eslint'].includes(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx|mts)$/.test(name) && !/\.(test|spec)\./.test(name) && !full.includes('/test/') && /env(\.|\[\s*['"])CONTENTOOLS_ORIGIN/.test(readFileSync(full, 'utf8'))) {
          hits.push(path.relative(root, full));
        }
      }
    };
    for (const d of ['app', 'components', 'lib', 'hooks', 'context']) {
      try {
        walk(path.join(root, d));
      } catch {
        // directory not created yet
      }
    }
    const unexpected = hits.filter((h) => !allowed.has(h));
    expect(unexpected).toEqual([]);
  });
});
