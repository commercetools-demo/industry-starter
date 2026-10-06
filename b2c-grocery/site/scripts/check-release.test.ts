// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkRelease, NETLIFY_TEMPLATE } from './check-release.mjs';

/**
 * Builds a throwaway repository (`<tmp>/netlify.toml`, `<tmp>/site/...`) and returns the `site/` directory.
 * Keys of `files` are relative to `site/`; keys starting with `../` are relative to the repository root.
 */
function project(files: Record<string, string>, { netlify = NETLIFY_TEMPLATE }: { netlify?: string | null } = {}) {
  const repo = mkdtempSync(path.join(tmpdir(), 'rel-'));
  const site = path.join(repo, 'site');
  mkdirSync(site, { recursive: true });
  if (netlify !== null) writeFileSync(path.join(repo, 'netlify.toml'), netlify);
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(site, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return site;
}

const GUARDED = "import { notFound } from 'next/navigation';\nexport function GET() { if (process.env.NODE_ENV !== 'development') notFound(); return new Response('ok'); }\n";

describe('checkRelease', () => {
  it('Production build: fails while app/api/health exists', () => {
    const root = project({ 'app/api/health/route.ts': 'export function GET() { return new Response("ok"); }\n' });
    expect(checkRelease(root)).toEqual(['app/api/health must not exist in a release build']);
  });

  it('passes when health is gone and there are no dev routes', () => {
    expect(checkRelease(project({ 'app/api/locale/route.ts': 'export {};\n' }))).toEqual([]);
  });

  it('fails a dev route without the guard', () => {
    const root = project({ 'app/api/dev/seed/route.ts': 'export function GET() { return new Response("ok"); }\n' });
    expect(checkRelease(root)).toHaveLength(1);
  });

  it('fails a dev route that checks NODE_ENV but never calls notFound', () => {
    const root = project({ 'app/[locale]/dev/page.tsx': "export default function P() { return process.env.NODE_ENV === 'development' ? null : null; }\n" });
    expect(checkRelease(root)).toHaveLength(1);
  });

  it('fails a dev route that hides the check behind a helper (no literal comparison)', () => {
    const root = project({ 'app/[locale]/dev/page.tsx': "import { notFound } from 'next/navigation';\nexport default function P() { if (!isDev()) notFound(); return null; }\n" });
    expect(checkRelease(root)).toHaveLength(1);
  });

  it('passes a guarded dev route', () => {
    expect(checkRelease(project({ 'app/api/dev/seed/route.ts': GUARDED }))).toEqual([]);
  });

  it('does not treat other files named like dev as dev routes', () => {
    expect(checkRelease(project({ 'app/api/devices/route.ts': 'export {};\n' }))).toEqual([]);
  });

  it('fails when netlify.toml is missing', () => {
    expect(checkRelease(project({}, { netlify: null }))).toEqual(['netlify.toml is missing at the repository root']);
  });

  it('fails when netlify.toml differs from the template', () => {
    const problems = checkRelease(project({}, { netlify: NETLIFY_TEMPLATE.replace('"22"', '"20"') }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^netlify\.toml does not match the template/);
  });

  it('accepts netlify.toml with different spacing and blank lines', () => {
    const loose = NETLIFY_TEMPLATE.replace(/ {2,}/g, ' ').replace('\n\n', '\n\n\n');
    expect(checkRelease(project({}, { netlify: loose }))).toEqual([]);
  });

  it('fails when a vercel.json exists', () => {
    expect(checkRelease(project({ 'vercel.json': '{}\n' }))).toEqual(['vercel.json must not exist (hosting is Netlify, D-003)']);
  });

  it('fails when an .env file is tracked, but allows .env.example', () => {
    const root = project({ '.env.local': 'X=1\n', '.env.example': 'X=\n' });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', '-f', '.env.local', '.env.example'], { cwd: root });
    expect(checkRelease(root)).toEqual(['.env.local: environment files must not be tracked']);
  });
});

describe('netlify.toml (Y-01)', () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  const toml = readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  const value = (key: string) => new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm').exec(toml)?.[1];

  it('Netlify build config: base, command, publish and Node version', () => {
    expect(value('base')).toBe('site');
    expect(value('command')).toBe('npm run build');
    expect(value('publish')).toBe('.next');
    expect(value('NODE_VERSION')).toBe('22');
  });

  it('declares no plugins and the repo has no vercel.json', () => {
    expect(toml).not.toMatch(/\[\[plugins\]\]/);
    expect(existsSync(path.join(root, 'vercel.json'))).toBe(false);
    expect(existsSync(path.join(root, 'site', 'vercel.json'))).toBe(false);
  });
});

describe('this repository (Y-02)', () => {
  it('passes the release check', () => {
    expect(checkRelease(path.resolve(import.meta.dirname, '..'))).toEqual([]);
  });
});
