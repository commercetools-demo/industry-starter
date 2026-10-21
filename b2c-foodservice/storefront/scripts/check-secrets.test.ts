import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSecrets, REQUIRED_NAMES } from './check-secrets.mjs';

const GOOD_EXAMPLE = [
  ...REQUIRED_NAMES.filter((n) => n !== 'CTP_SCOPES').map((n) => `${n}=`),
  '# Reasons:',
  '# view_products : product pages',
  'CTP_SCOPES=',
  '',
].join('\n');

function dir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'secrets-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content);
  return root;
}

function walk(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('secret checks (static half)', () => {
  it('.env.example lists every variable with an empty value', () => {
    expect(checkSecrets(dir({ '.env.example': GOOD_EXAMPLE }))).toEqual([]);
    const missing = checkSecrets(dir({ '.env.example': GOOD_EXAMPLE.replace('SESSION_SECRET=\n', '') }));
    expect(missing.join('\n')).toContain('does not list SESSION_SECRET');
    const valued = checkSecrets(dir({ '.env.example': GOOD_EXAMPLE.replace('SESSION_SECRET=', 'SESSION_SECRET=abc') }));
    expect(valued.join('\n')).toContain('gives SESSION_SECRET a value');
    expect(valued.join('\n')).not.toContain('abc');
  });

  it('A scope without a reason fails', () => {
    const bad = GOOD_EXAMPLE.replace('# view_products : product pages', '# view_products');
    expect(checkSecrets(dir({ '.env.example': bad })).join('\n')).toContain('not "# <scope> : <reason>"');
  });

  it('Public prefix on a secret fails', () => {
    const bad = GOOD_EXAMPLE + 'NEXT_PUBLIC_CTP_CLIENT_SECRET=\n';
    expect(checkSecrets(dir({ '.env.example': bad })).join('\n')).toContain('must not be public');
  });

  it('Only .env.local and .env.example may exist', () => {
    const ok = dir({ '.env.example': GOOD_EXAMPLE, '.env.local': 'A=b\n' });
    expect(checkSecrets(ok)).toEqual([]);
    for (const name of ['.env', '.env.development', '.env.production']) {
      const bad = dir({ '.env.example': GOOD_EXAMPLE, [name]: 'A=b\n' });
      expect(checkSecrets(bad).join('\n')).toContain(`${name} must not exist`);
    }
  });

  it('The real storefront passes the static secret checks', () => {
    expect(checkSecrets(process.cwd())).toEqual([]);
  });

  it('No code reads credentials from the home directory', () => {
    const forbidden = ['home' + 'dir(', '~/.commerce' + 'tools', '.commerce' + 'tools'];
    const offenders: string[] = [];
    for (const top of ['lib', 'app', 'scripts']) {
      const base = join(process.cwd(), top);
      mkdirSync(base, { recursive: true });
      for (const file of walk(base)) {
        if (/\.test\.[a-z]+$/.test(file) || !/\.(ts|tsx|mjs|js)$/.test(file)) continue;
        const text = readFileSync(file, 'utf8');
        for (const needle of forbidden) if (text.includes(needle)) offenders.push(`${file}: ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
