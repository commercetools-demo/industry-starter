import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// WCAG 1.3.1: a data table has an accessible name (caption, aria-label or aria-labelledby) and column headers with a scope.
// Source scan, so every table in every state is covered, including the ones no component test renders.
const ROOT = path.resolve(import.meta.dirname);
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f) ? [p] : [];
  });

const tables = files(ROOT).flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/g)].map((m) => ({ file: path.relative(ROOT, file), attrs: m[1], body: m[2] }));
});

describe('table has caption and scope', () => {
  it('finds the tables of the portal', () => {
    expect(tables.length).toBeGreaterThan(15);
  });

  it('every table has a caption or an accessible name', () => {
    const unnamed = tables.filter((t) => !/<caption\b/.test(t.body) && !/aria-label(ledby)?=/.test(t.attrs)).map((t) => t.file);
    expect(unnamed).toEqual([]);
  });

  it('every column header declares its scope', () => {
    const bad = tables.flatMap((t) => [...t.body.matchAll(/<th\b([^>]*)>/g)].filter((h) => !/\bscope=/.test(h[1])).map(() => t.file));
    expect([...new Set(bad)]).toEqual([]);
  });
});

describe('scrolling table wrappers (1.4.10 reflow, 2.1.1 keyboard)', () => {
  it('every wrapper that scrolls a table sideways is a focusable, named group or region', () => {
    const bad = files(ROOT).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(/<div className=\{tableScroll\}([^>]*)>/g)]
        .filter((m) => !/tabIndex=\{0\}/.test(m[1]) || !/aria-label(ledby)?=/.test(m[1]) || !/role="(group|region)"/.test(m[1]))
        .map(() => path.relative(ROOT, file));
    });
    expect(bad).toEqual([]);
  });
});
