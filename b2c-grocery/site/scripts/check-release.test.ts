// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
