import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSecrets, SECRET_VARS } from './check-secrets.mjs';
import { checkServerOnly } from './check-server-only.mjs';
import { checkTailwind } from './check-tailwind.mjs';
import { checkVersions, parseVersion } from './check-versions.mjs';

const dirs = [];
function tmp(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'malva-gate-'));
  dirs.push(root);
  for (const [f, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    writeFileSync(path.join(root, f), content);
  }
  return root;
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });

const pkg = (deps) => JSON.stringify({ dependencies: deps });
const GOOD = { next: '^16.2.0', 'next-intl': '^4.14.0', '@commercetools/platform-sdk': '^8.27.0', '@commercetools/ts-client': '^4.10.0' };

describe('malva-project-bootstrap › Version gate', () => {
  it('passes on the supported versions', () => {
    expect(checkVersions(tmp({ 'package.json': pkg(GOOD) }))).toEqual([]);
  });
  it('fails when next is below 16, next-intl below 4 or an SDK major changed', () => {
    const problems = checkVersions(tmp({ 'package.json': pkg({ ...GOOD, next: '^15.5.0', 'next-intl': '^3.26.0', '@commercetools/platform-sdk': '^9.6.0', '@commercetools/ts-client': '^5.1.0' }) }));
    expect(problems).toHaveLength(4);
    expect(problems.join('\n')).toMatch(/next 15\.5\.0 is below/);
    expect(problems.join('\n')).toMatch(/platform-sdk 9\.6\.0 must stay on major 8/);
  });
  it('reports a missing dependency and reads installed versions first', () => {
    expect(checkVersions(tmp({ 'package.json': pkg({ next: '^16.0.0' }) })).join('\n')).toMatch(/next-intl: not installed/);
    const root = tmp({ 'package.json': pkg(GOOD), 'node_modules/next/package.json': JSON.stringify({ version: '15.0.0' }) });
    expect(checkVersions(root).join('\n')).toMatch(/next 15\.0\.0 is below/);
  });
  it('parses versions', () => {
    expect(parseVersion('^16.2.6')).toEqual([16, 2, 6]);
    expect(parseVersion('latest')).toBeNull();
  });
});

describe('malva-project-bootstrap › Tailwind v4 without a config file', () => {
  const ok = { 'app/globals.css': "@import 'tailwindcss';\n", 'postcss.config.mjs': "export default { plugins: { '@tailwindcss/postcss': {} } };" };
  it('passes with the v4 setup', () => expect(checkTailwind(tmp(ok))).toEqual([]));
  it('fails with a config file, a wrong first import or the v3 postcss plugin', () => {
    const problems = checkTailwind(tmp({ 'tailwind.config.ts': 'export default {}', 'app/globals.css': '@tailwind base;', 'postcss.config.mjs': 'export default { plugins: { tailwindcss: {} } };' }));
    expect(problems).toHaveLength(3);
  });
});

describe('malva-project-bootstrap › Server-only modules guarded at build time', () => {
  it('passes when every guarded file starts with the import', () => {
    const root = tmp({ 'lib/ct/index.ts': "import 'server-only';\nexport {};", 'lib/ct/a.test.ts': 'no guard in tests', 'lib/session.ts': "// session\nimport 'server-only';", 'lib/utils.ts': 'export {};' });
    expect(checkServerOnly(root)).toEqual([]);
  });
  it('names the files that lack it', () => {
    const root = tmp({ 'lib/ct/client.ts': 'export {};', 'lib/ct/deep/x.ts': "import 'server-only';", 'lib/session.ts': 'export {};', 'lib/session-cookie.ts': 'export {};' });
    expect(checkServerOnly(root).sort()).toEqual(["lib/ct/client.ts must start with import 'server-only'", "lib/session-cookie.ts must start with import 'server-only'", "lib/session.ts must start with import 'server-only'"].sort());
  });
});

describe('malva-project-bootstrap › Secrets and environment files', () => {
  const example = SECRET_VARS.map((v) => `# comment\n${v}=\n`).join('');
  it('passes with an empty-valued .env.example and nothing tracked', () => {
    expect(checkSecrets(tmp({ '.env.example': example }), ['app/page.tsx', '.env.example'])).toEqual([]);
  });
  it('No public prefix on secrets', () => {
    const root = tmp({ '.env.example': example, 'lib/x.ts': 'const k = process.env.NEXT_PUBLIC_CTP_CLIENT_SECRET;', 'lib/y.ts': 'process.env.NEXT_PUBLIC_SOME_TOKEN' });
    expect(checkSecrets(root, []).filter((p) => p.includes('NEXT_PUBLIC_'))).toHaveLength(2);
  });
  it('Nothing committed', () => {
    const problems = checkSecrets(tmp({ '.env.example': example }), ['.env', '.env.local', 'site/.env.production', '.next/cache/x', '.env.example']);
    expect(problems).toEqual(['.env is tracked by git', '.env.local is tracked by git', 'site/.env.production is tracked by git', '.next/cache/x is tracked by git']);
  });
  it('requires .env.example without values', () => {
    expect(checkSecrets(tmp({}), [])).toEqual(['.env.example is missing']);
    expect(checkSecrets(tmp({ '.env.example': example.replace('SESSION_SECRET=\n', 'SESSION_SECRET=abc\n') }), []).join('')).toMatch(/must list SESSION_SECRET=/);
  });
});
