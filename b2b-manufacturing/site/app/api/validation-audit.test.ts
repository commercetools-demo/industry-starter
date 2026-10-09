// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const root = path.join(process.cwd(), 'app/api');
const routes = walk(root).filter((f) => f.endsWith('/route.ts'));

describe('malva-project-bootstrap › Input safety', () => {
  it('finds the route handlers', () => { expect(routes.length).toBeGreaterThan(8); });
  it('every handler that accepts a body validates it with a zod schema (parseBody)', () => {
    const offenders = routes
      .filter((f) => /export const (POST|PUT|PATCH|DELETE)\b|export async function (POST|PUT|PATCH|DELETE)\b/.test(readFileSync(f, 'utf8')))
      .filter((f) => { const s = readFileSync(f, 'utf8'); return /request\.(json|formData|text)\(/.test(s) && !/parseBody\(/.test(s); })
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
  it('no handler reads a body without validating it, and none renders user text as HTML', () => {
    const all = [...walk(path.join(process.cwd(), 'app')), ...walk(path.join(process.cwd(), 'components'))].filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const html = all.filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML')).map((f) => path.relative(process.cwd(), f)).sort();
    // The only allowed uses are JSON-LD script tags (JSON, with `<` escaped by jsonLdString).
    for (const f of html) expect(readFileSync(path.join(process.cwd(), f), 'utf8'), f).toMatch(/application\/ld\+json/);
  });
});
