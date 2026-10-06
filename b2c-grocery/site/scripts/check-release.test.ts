// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkRelease } from './check-release.mjs';

function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'rel-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  }
  return root;
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

  it('passes a guarded dev route', () => {
    expect(checkRelease(project({ 'app/api/dev/seed/route.ts': GUARDED }))).toEqual([]);
  });

  it('does not treat other files named like dev as dev routes', () => {
    expect(checkRelease(project({ 'app/api/devices/route.ts': 'export {};\n' }))).toEqual([]);
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
