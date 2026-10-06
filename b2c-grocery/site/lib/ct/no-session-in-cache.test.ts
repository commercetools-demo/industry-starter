import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const dir = __dirname;
const sources = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

const imports = (code: string, specifier: RegExp) =>
  [...code.matchAll(/(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)].some((m) => specifier.test(m[1] ?? m[2] ?? ''));

describe('no session inside unstable_cache (cache is shared across users)', () => {
  it('lib/ct has source files to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)('%s: a file using unstable_cache does not import the session', (file) => {
    const code = readFileSync(path.join(dir, file), 'utf8');
    const usesCache = imports(code, /^next\/cache$/) && /\bunstable_cache\b/.test(code);
    const usesSession = imports(code, /(^|\/)session$/);
    expect(usesCache && usesSession).toBe(false);
  });

  it('the detector flags a file that does both', () => {
    const bad = `import { unstable_cache } from 'next/cache';\nimport { getSession } from '@/lib/session';`;
    expect(imports(bad, /^next\/cache$/) && imports(bad, /(^|\/)session$/)).toBe(true);
  });
});
