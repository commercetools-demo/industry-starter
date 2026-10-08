// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import securityHeaders from '../config/security-headers.json';
import { checkRelease, NETLIFY_TEMPLATE } from './check-release.mjs';

const ENV_EXAMPLE = [
  'CTP_PROJECT_KEY=spec-test-b2c-telecom',
  'CTP_AUTH_URL=https://auth.example.test',
  'CTP_API_URL=https://api.example.test',
  'CTP_CLIENT_ID=',
  'CTP_CLIENT_SECRET=',
  'CTP_SCOPES=',
  'CTP_CHECKOUT_APP_KEY=',
  'SESSION_SECRET=',
  '',
].join('\n');
// The three non-secret project defaults may be prefilled; the other five names must stay empty.
const ENV_EXAMPLE_EMPTY = ENV_EXAMPLE;
const BUILD_NETLIFY = 'npm run check:lockfile && npm run check:secrets && npm run build && npm run check:bundle';
const GUARDED =
  "import { notFound } from 'next/navigation';\nexport function GET() { if (process.env.NODE_ENV !== 'development') notFound(); return new Response('ok'); }\n";

type Options = { netlify?: string | null; envExample?: string | null; headers?: unknown; buildNetlify?: string | null };

/** Builds a throwaway project folder (`<tmp>/netlify.toml`, `<tmp>/site/...`) and returns `{ repo, site }`. */
function project(files: Record<string, string> = {}, options: Options = {}) {
  const repo = mkdtempSync(path.join(tmpdir(), 'rel-'));
  const site = path.join(repo, 'site');
  mkdirSync(path.join(site, 'config'), { recursive: true });
  const netlify = options.netlify === undefined ? NETLIFY_TEMPLATE : options.netlify;
  if (netlify !== null) writeFileSync(path.join(repo, 'netlify.toml'), netlify);
  const envExample = options.envExample === undefined ? ENV_EXAMPLE_EMPTY : options.envExample;
  if (envExample !== null) writeFileSync(path.join(site, '.env.example'), envExample);
  writeFileSync(path.join(site, 'config', 'security-headers.json'), JSON.stringify(options.headers ?? securityHeaders));
  const build = options.buildNetlify === undefined ? BUILD_NETLIFY : options.buildNetlify;
  writeFileSync(path.join(site, 'package.json'), JSON.stringify({ scripts: build === null ? {} : { 'build:netlify': build } }));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(repo, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return { repo, site };
}

function gitInit(repo: string, files: string[]) {
  const run = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
  run('init', '-q');
  run('add', '-f', ...files);
}

describe('checkRelease', () => {
  it('passes a complete project', () => {
    expect(checkRelease(project().site)).toEqual([]);
  });

  it('rule 1: netlify.toml is missing at the repository root', () => {
    expect(checkRelease(project({}, { netlify: null }).site)).toContain('netlify.toml is missing at the repository root');
  });

  it('rule 2: netlify.toml does not match the template (base site, command npm run build:netlify, Node 22, plugin, headers)', () => {
    const message = 'netlify.toml does not match the template (base site, command npm run build:netlify, Node 22, plugin, headers)';
    expect(checkRelease(project({}, { netlify: NETLIFY_TEMPLATE.replace('"22"', '"20"') }).site)).toContain(message);
    // Blank lines, spacing and CRLF do not matter.
    const loose = NETLIFY_TEMPLATE.replace(/\n/g, '\r\n\r\n').replace('base    =', 'base =');
    expect(checkRelease(project({}, { netlify: loose }).site)).toEqual([]);
  });

  it('rule 3: vercel.json must not exist', () => {
    const message = 'vercel.json must not exist (hosting is Netlify, D-002)';
    expect(checkRelease(project({ 'vercel.json': '{}' }).site)).toEqual([message]);
    expect(checkRelease(project({ 'site/vercel.json': '{}' }).site)).toEqual([message]);
  });

  it('rule 4: .env.local is tracked fails, .env.example passes', () => {
    const tracked = project({ 'site/.env.local': 'X=1\n', '.envrc': 'export X=1\n' });
    gitInit(tracked.repo, ['site/.env.local', '.envrc', 'site/.env.example']);
    expect(checkRelease(tracked.site).sort()).toEqual([
      '.envrc: environment files must not be tracked',
      'site/.env.local: environment files must not be tracked',
    ]);
    const clean = project();
    gitInit(clean.repo, ['site/.env.example']);
    expect(checkRelease(clean.site)).toEqual([]);
  });

  it('rule 5: .env.example must list <NAME> with an empty value', () => {
    expect(checkRelease(project({}, { envExample: null }).site)).toHaveLength(8);
    const filled = ENV_EXAMPLE_EMPTY.replace('SESSION_SECRET=', 'SESSION_SECRET=abc');
    expect(checkRelease(project({}, { envExample: filled }).site)).toEqual(['.env.example must list SESSION_SECRET with an empty value']);
    const missing = ENV_EXAMPLE_EMPTY.replace('CTP_SCOPES=\n', '');
    expect(checkRelease(project({}, { envExample: missing }).site)).toEqual(['.env.example must list CTP_SCOPES with an empty value']);
  });

  it('rule 6: netlify.toml is missing security header <key>', () => {
    const headers = [...securityHeaders, { key: 'X-Extra', value: 'yes' }];
    expect(checkRelease(project({}, { headers }).site)).toEqual(['netlify.toml is missing security header X-Extra']);
  });

  it('rule 7: SECRETS_SCAN_OMIT_KEYS must not include <NAME>', () => {
    const netlify = NETLIFY_TEMPLATE.replace('CTP_PROJECT_KEY,', 'CTP_PROJECT_KEY,SESSION_SECRET,');
    expect(checkRelease(project({}, { netlify }).site)).toContain('SECRETS_SCAN_OMIT_KEYS must not include SESSION_SECRET');
  });

  it('rule 8: package.json build:netlify does not match the release template', () => {
    const message = 'package.json build:netlify does not match the release template';
    expect(checkRelease(project({}, { buildNetlify: 'npm run build' }).site)).toEqual([message]);
    expect(checkRelease(project({}, { buildNetlify: null }).site)).toEqual([message]);
  });

  it('rule 9: unguarded app/api/health fails, guarded passes', () => {
    const unguarded = project({ 'site/app/api/health/route.ts': 'export function GET() { return new Response("ok"); }\n' });
    expect(checkRelease(unguarded.site)).toEqual([
      "app/api/health/route.ts: dev-only route lacks the NODE_ENV === 'development' guard that calls notFound()",
    ]);
    expect(checkRelease(project({ 'site/app/api/health/route.ts': GUARDED }).site)).toEqual([]);
  });

  it('rule 9: a guard without notFound, and a dev route without a guard, fail', () => {
    const noNotFound = project({ 'site/app/[locale]/dev/page.tsx': "export default function P() { return process.env.NODE_ENV === 'development' ? null : null; }\n" });
    expect(checkRelease(noNotFound.site)).toHaveLength(1);
    const bare = project({ 'site/app/api/dev/seed/route.ts': 'export function GET() { return new Response("ok"); }\n' });
    expect(checkRelease(bare.site)).toHaveLength(1);
  });

  it('rule 9: *.dev.ts routes (absent from production builds) and app/api/devices are not flagged', () => {
    const files = {
      'site/app/api/health/route.dev.ts': 'export function GET() { return new Response("ok"); }\n',
      'site/app/dev/tokens/page.dev.tsx': 'export default function P() { return null; }\n',
      'site/app/api/devices/route.ts': 'export {};\n',
    };
    expect(checkRelease(project(files).site)).toEqual([]);
  });
});
