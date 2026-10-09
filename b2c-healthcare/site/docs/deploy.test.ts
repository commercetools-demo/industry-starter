import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Y-02: every environment variable NAME the code reads (process.env.X, env.X, env['X']) or the example files list must be
// documented in docs/deploy.md. Names only: the test never reads a value.

const ROOT = resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'docs']);
const doc = readFileSync(join(ROOT, 'docs', 'deploy.md'), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : sourceFiles(path);
    return /\.(ts|tsx|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !path.includes('/test/') ? [path] : [];
  });
}

const fromCode = new Map<string, string>();
for (const file of sourceFiles(ROOT)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\b(?:process\.)?env(?:\.|\[['"])([A-Z][A-Z0-9_]{2,})/g)) fromCode.set(match[1] as string, relative(ROOT, file));
  // Names passed to a getter, e.g. get('CTP_CHECKOUT_APP_KEY'), are caught through the example files below.
}

const fromExamples = new Set<string>();
for (const example of ['.env.example', '.env.seed.example']) {
  for (const match of readFileSync(join(ROOT, example), 'utf8').matchAll(/^([A-Z][A-Z0-9_]+)=/gm)) fromExamples.add(match[1] as string);
}

describe('docs/deploy.md (Y-02)', () => {
  it('scans a plausible set of names (guards the scan itself)', () => {
    for (const name of ['CTP_CLIENT_SECRET', 'SESSION_SECRET', 'RETENTION_SECRET', 'RELOAD_ALLOWANCES_SECRET', 'AUTO_REFILL_RUN_SECRET']) {
      expect(fromCode.has(name) || fromExamples.has(name), name).toBe(true);
    }
  });

  it('documents every environment variable name used in the code', () => {
    const missing = [...fromCode.keys()].filter((name) => !doc.includes(`\`${name}\``));
    expect(missing, `undocumented: ${missing.map((n) => `${n} (${fromCode.get(n)})`).join(', ')}`).toEqual([]);
  });

  it('documents every name in .env.example and .env.seed.example', () => {
    expect([...fromExamples].filter((name) => !doc.includes(`\`${name}\``))).toEqual([]);
  });

  it('lists names only: no value-like assignment', () => {
    expect(doc).not.toMatch(/\b(?:CTP_[A-Z_]+|[A-Z_]+_SECRET)=\S/);
  });

  it('names the three scheduled functions with their crons', () => {
    for (const cron of ['0 5 * * *', '10 0 1 * *', '30 3 * * *']) expect(doc).toContain(cron);
  });
});
