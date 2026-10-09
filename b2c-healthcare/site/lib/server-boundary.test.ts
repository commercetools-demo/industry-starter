// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

function sources(dirs: string[]): { file: string; code: string }[] {
  const out: { file: string; code: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push({ file: relative(root, full), code: readFileSync(full, 'utf8') });
      }
    }
  };
  for (const d of dirs) walk(join(root, d));
  return out;
}

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const isClient = (code: string) => /^\s*(['"])use client\1/.test(code);

/** Returns the `redirect(`/`notFound(` calls that sit inside a try block that has no unstable_rethrow in its catch. */
export function navigationInsideTry(code: string): number[] {
  const text = stripComments(code);
  const hits: number[] = [];
  const tryRe = /\btry\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = tryRe.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      i++;
    }
    const body = text.slice(start, i - 1);
    const rest = text.slice(i);
    const catchMatch = /^\s*catch\s*(\([^)]*\))?\s*\{/.exec(rest);
    let catchBody = '';
    if (catchMatch) {
      let d = 1;
      let j = catchMatch[0].length;
      while (j < rest.length && d > 0) {
        if (rest[j] === '{') d++;
        else if (rest[j] === '}') d--;
        j++;
      }
      catchBody = rest.slice(catchMatch[0].length, j - 1);
    }
    if (/\b(redirect|notFound|permanentRedirect)\s*\(/.test(body) && !/unstable_rethrow\s*\(/.test(catchBody)) {
      hits.push(m.index);
    }
  }
  return hits;
}

describe('storefront-data-loading: Server Component boundary', () => {
  it('Navigation helpers: no redirect()/notFound() inside try/catch without unstable_rethrow (app, lib)', () => {
    const offenders = sources(['app', 'lib', 'components', 'hooks'])
      .filter(({ code }) => navigationInsideTry(code).length > 0)
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('Navigation helpers: the scanner flags a try/catch without unstable_rethrow and accepts one with it', () => {
    const bad = "async function f() { try { notFound(); } catch (e) { console.log(e); } }";
    const good = "async function f() { try { redirect('/x'); } catch (e) { unstable_rethrow(e); } }";
    const fine = "async function f() { const x = await load(); if (!x) notFound(); try { await save(); } catch {} }";
    expect(navigationInsideTry(bad)).toHaveLength(1);
    expect(navigationInsideTry(good)).toHaveLength(0);
    expect(navigationInsideTry(fine)).toHaveLength(0);
  });

  it('Interactive child: Server Component pages and layouts attach no event handlers (those live in a use-client child)', () => {
    const offenders = sources(['app'])
      .filter(({ file, code }) => /(^|\/)(page|layout|template|not-found)\.tsx$/.test(file) && !isClient(code))
      .filter(({ code }) => /\bon[A-Z][A-Za-z]*=\{/.test(stripComments(code)))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('Interactive child: the SWR provider is a client component receiving plain data', () => {
    const provider = readFileSync(join(root, 'components/providers/SwrProvider.tsx'), 'utf8');
    expect(isClient(provider)).toBe(true);
    expect(provider).toMatch(/fallback: Record<string, unknown>/);
  });
});
