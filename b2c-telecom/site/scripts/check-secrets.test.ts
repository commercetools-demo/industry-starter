// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkSecrets } from './check-secrets.mjs';

let repo: string;

function put(file: string, content: string) {
  const full = path.join(repo, file);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'secrets-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  put('.gitignore', '.env.local\n.env.seed\n');
  put('.env.example', 'CTP_PROJECT_KEY=spec-test-b2c-telecom\nCTP_CLIENT_ID=\nCTP_CLIENT_SECRET=\nSESSION_SECRET=\nCTP_CHECKOUT_APP_KEY=\n');
  put('lib/ok.ts', "export const name = 'SESSION_SECRET';\n");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('check-secrets', () => {
  it('passes for a clean repository, ignoring an untracked ignored .env.local', () => {
    put('.env.local', 'CTP_CLIENT_SECRET=realsecretvalue1234567890realsecret\n');
    expect(checkSecrets(repo)).toEqual([]);
  });

  it('Secret never reaches the browser: a NEXT_PUBLIC_ secret variable is reported', () => {
    put('lib/a.ts', 'export const a = process.env.NEXT_PUBLIC_CTP_PROJECT_KEY;\n');
    put('components/b.tsx', 'export const b = process.env.NEXT_PUBLIC_SESSION_SECRET;\n');
    const problems = checkSecrets(repo);
    expect(problems).toContain('lib/a.ts: contains NEXT_PUBLIC_… (server secrets must never be public)');
    expect(problems).toContain('components/b.tsx: contains NEXT_PUBLIC_… (server secrets must never be public)');
  });

  it('rule a ignores scripts/ and tests, and harmless public variables', () => {
    put('scripts/x.mjs', "const n = 'NEXT_PUBLIC_CTP_X';\n");
    put('lib/a.test.ts', "const n = 'NEXT_PUBLIC_SESSION_X';\n");
    put('lib/c.ts', 'export const url = process.env.NEXT_PUBLIC_SITE_URL;\n');
    expect(checkSecrets(repo)).toEqual([]);
  });

  it('rule b: a non-empty secret in .env.example and a seed mention are reported', () => {
    put('.env.example', 'CTP_CLIENT_SECRET=abc\nCTP_SEED_CLIENT_ID=\n');
    const problems = checkSecrets(repo);
    expect(problems).toContain('.env.example: CTP_CLIENT_SECRET must be empty');
    expect(problems).toContain('.env.example: seed credentials must not be configured for site/');
  });

  it('rule b: .env.seed.example may mention seed names but must keep them empty', () => {
    put('.env.seed.example', 'CTP_SEED_CLIENT_ID=\nCTP_SEED_CLIENT_SECRET=value\n');
    expect(checkSecrets(repo)).toEqual(['.env.seed.example: CTP_SEED_CLIENT_SECRET must be empty']);
  });

  it('rule c: a tracked .env.local fails, .env.example passes', () => {
    put('.env.local', 'X=1\n');
    execFileSync('git', ['add', '-f', '.env.local', '.env.example'], { cwd: repo });
    expect(checkSecrets(repo)).toEqual(['.env.local: env file must not be tracked']);
  });

  it('rule d: a 32+ character literal assigned to SESSION_SECRET fails, a shorter one passes', () => {
    const planted = 'p'.repeat(40);
    put('lib/s.ts', `const SESSION_SECRET = '${planted}';\n`);
    put('lib/t.ts', "const SESSION_SECRET = 'short';\n");
    const problems = checkSecrets(repo);
    expect(problems).toEqual(['lib/s.ts: string literal assigned to a secret variable']);
    expect(problems.join('\n')).not.toContain(planted);
  });

  it('rule d ignores scripts/ and tests', () => {
    put('scripts/s.ts', `const CLIENT_SECRET = '${'q'.repeat(40)}';\n`);
    put('lib/s.test.ts', `const SESSION_SECRET = '${'q'.repeat(40)}';\n`);
    expect(checkSecrets(repo)).toEqual([]);
  });

  it('messages never contain planted secret values', () => {
    const planted = 'z'.repeat(36);
    put('.env.example', `SESSION_SECRET=${planted}\n`);
    put('lib/s.ts', `export const CLIENT_SECRET = "${planted}";\n`);
    expect(checkSecrets(repo).join('\n')).not.toContain(planted);
  });

  it('falls back to a directory walk outside git', () => {
    const plain = mkdtempSync(path.join(tmpdir(), 'plain-'));
    mkdirSync(path.join(plain, 'node_modules/x'), { recursive: true });
    writeFileSync(path.join(plain, 'node_modules/x/a.ts'), 'NEXT_PUBLIC_CTP_X');
    writeFileSync(path.join(plain, 'b.ts'), 'NEXT_PUBLIC_CTP_X');
    expect(checkSecrets(plain)).toEqual(['b.ts: contains NEXT_PUBLIC_… (server secrets must never be public)']);
    rmSync(plain, { recursive: true, force: true });
  });
});
