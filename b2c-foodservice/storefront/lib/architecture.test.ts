// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DIRS = ['app', 'lib', 'hooks', 'components', 'context'];
const UI_DIRS = ['components', 'hooks', 'context'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__fixtures__' || name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|live)\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(join(ROOT, d))).map((f) => ({
  path: relative(ROOT, f).split('\\').join('/'),
  text: readFileSync(f, 'utf8'),
}));

const isUi = (p: string) => UI_DIRS.some((d) => p.startsWith(`${d}/`)) || (p.startsWith('app/') && p.endsWith('.tsx'));

describe('architecture guards', () => {
  it('Raw fetch to commercetools: no fetch call targets a commercetools host', () => {
    const offenders = files
      .filter((f) => /\bfetch\s*\(/.test(f.text) && /commercetools\.com|CTP_API_URL|CTP_AUTH_URL/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('Catalogue reads use Product Search: nothing calls productProjections().search()', () => {
    const offenders = files.filter((f) => /productProjections\(\)\s*\.search\s*\(/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('unstable_cache is called only in lib/ct/public-cache.ts', () => {
    const offenders = files
      .filter((f) => f.path !== 'lib/ct/public-cache.ts' && /unstable_cache/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
    expect(files.find((f) => f.path === 'lib/ct/public-cache.ts')?.text).toMatch(/unstable_cache\(/);
  });

  it("Every lib/ct file starts with import 'server-only'", () => {
    // image-config is pure string work that client components call (Q-D-17).
    const offenders = files
      .filter((f) => f.path.startsWith('lib/ct/') && f.path !== 'lib/ct/image-config.ts')
      .filter((f) => !f.text.startsWith("import 'server-only';"))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('lib/session.ts, lib/env.ts and lib/api.ts are server-only', () => {
    for (const p of ['lib/session.ts', 'lib/env.ts', 'lib/api.ts']) {
      expect(files.find((f) => f.path === p)?.text.startsWith("import 'server-only';"), p).toBe(true);
    }
  });

  it('Components do not import from lib/ct, lib/mappers or lib/session', () => {
    const bad = /from\s+['"](?:@\/lib\/(?:ct|mappers|session)(?:\/[^'"]*)?|(?:\.\.?\/)+lib\/(?:ct|mappers|session)[^'"]*)['"]/g;
    const offenders = files
      .filter((f) => isUi(f.path))
      .filter((f) => [...f.text.matchAll(bad)].some((m) => !m[0].includes('lib/ct/image-config')))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('getLocalizedString is not used in components', () => {
    const offenders = files.filter((f) => isUi(f.path) && /getLocalizedString/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('the guard actually sees the source tree', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.path === 'lib/ct/client.ts')).toBe(true);
  });

  it('every commercetools client masks sensitive headers, so an error that is thrown or logged never carries the bearer token', () => {
    const builders = files.filter((f) => /\.withHttpMiddleware\(/.test(f.text));
    expect(builders.length).toBeGreaterThanOrEqual(2);
    const offenders = builders.filter((f) => !/maskSensitiveHeaderData:\s*true/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
