// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkSecrets } from './check-secrets.mjs';

/** Creates a temp git repo with a `site/` project and returns the site dir. */
function repo(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'sec-'));
  const site = path.join(root, 'site');
  mkdirSync(site, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(site, rel)), { recursive: true });
    writeFileSync(path.join(site, rel), content);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-f', '-A'], { cwd: root });
  return site;
}

const CLEAN_EXAMPLE = 'CTP_CLIENT_ID=\nCTP_CLIENT_SECRET=\nSESSION_SECRET=\nCTP_CHECKOUT_APP_KEY=\nCTP_PROJECT_KEY=demo\n';

describe('checkSecrets', () => {
  it('Secret in client bundle: passes on a clean project', () => {
    const site = repo({ '.env.example': CLEAN_EXAMPLE, 'app/page.tsx': 'export default function P() { return null; }\n' });
    expect(checkSecrets(site)).toEqual([]);
  });

  it('rule a: flags NEXT_PUBLIC_CTP and NEXT_PUBLIC_SESSION in source', () => {
    const site = repo({
      'lib/a.ts': 'export const a = process.env.NEXT_PUBLIC_CTP_CLIENT_SECRET;\n',
      'lib/b.ts': 'export const b = process.env.NEXT_PUBLIC_SESSION_SECRET;\n',
    });
    const problems = checkSecrets(site);
    expect(problems.some((p) => p.startsWith('lib/a.ts'))).toBe(true);
    expect(problems.some((p) => p.startsWith('lib/b.ts'))).toBe(true);
  });

  it('rule a: ignores scripts/ and test files', () => {
    const site = repo({
      'scripts/x.mjs': "const n = 'NEXT_PUBLIC_CTP';\n",
      'lib/a.test.ts': "const n = 'NEXT_PUBLIC_SESSION';\n",
    });
    expect(checkSecrets(site)).toEqual([]);
  });

  it('rule b: flags a non-empty secret in .env.example (without printing the value)', () => {
    const site = repo({ '.env.example': 'SESSION_SECRET=abcdefghijklmnop\nCTP_CLIENT_ID=\n' });
    const problems = checkSecrets(site);
    expect(problems).toEqual(['.env.example: SESSION_SECRET must be empty']);
  });

  it('rule b: non-secret values in .env.example are fine', () => {
    const site = repo({ '.env.example': 'CTP_PROJECT_KEY=demo\nHOME_LAYOUT=editorial\n' });
    expect(checkSecrets(site)).toEqual([]);
  });

  it('rule c: flags a tracked .env.local but passes .env.example', () => {
    const site = repo({ '.env.example': CLEAN_EXAMPLE, '.env.local': 'CTP_PROJECT_KEY=demo\n' });
    expect(checkSecrets(site)).toEqual(['.env.local: env file must not be tracked (only .env.example)']);
  });

  it('rule d: flags a long literal assigned to SESSION_SECRET', () => {
    const site = repo({ 'lib/s.ts': "const SESSION_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789';\n" });
    expect(checkSecrets(site)).toEqual(['lib/s.ts: string literal assigned to a secret variable']);
  });

  it('rule d: reading from process.env is fine', () => {
    const site = repo({ 'lib/s.ts': 'const SESSION_SECRET = process.env.SESSION_SECRET;\n' });
    expect(checkSecrets(site)).toEqual([]);
  });
});
