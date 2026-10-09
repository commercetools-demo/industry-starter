import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkNoDevPages } from './check-no-dev-pages.mjs';
import { checkTokens, lintSource, tokenMap } from './check-tokens.mjs';

const dirs = [];
function tmp(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'malva-tok-'));
  dirs.push(root);
  for (const [f, c] of Object.entries(files)) { mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); writeFileSync(path.join(root, f), c); }
  return root;
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });

const root = process.cwd();
const sourceCss = path.resolve(root, '..', 'design', 'malva', 'source', 'colors_and_type.css');
const globals = readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

describe('malva-project-bootstrap › Tokens present', () => {
  it('every --sl-* token of the design source exists in globals.css with the same value (parity)', () => {
    expect(checkTokens(root, sourceCss)).toEqual([]);
  });
  it('carries the brand values the design relies on', () => {
    const t = tokenMap(globals);
    expect(t.get('--sl-navy-900')).toBe('#173A5F');
    expect(t.get('--sl-ink')).toBe('#212121');
    expect(t.get('--r-0')).toBe('0');
    expect(t.get('--font-display')).toContain("'Inter Display'");
  });
  it('.btn is sharp and 48px tall; .btn.sm is 40px', () => {
    const rule = (sel) => new RegExp(`${sel.replace(/\./g, '\\.')}\\{([^}]*)\\}`).exec(globals)?.[1] ?? '';
    expect(rule('.btn')).toMatch(/border-radius:0/);
    expect(rule('.btn')).toMatch(/height:48px/);
    expect(rule('.btn.sm')).toMatch(/height:40px/);
  });
  it('a bad hex colour fails', () => {
    expect(lintSource('components/a.css', '.x { color: #ff0000; }')).toEqual(['components/a.css: raw colour #ff0000; use a --sl-* token']);
    expect(lintSource('components/a.tsx', "const s = { background: '#abc' };").join('')).toMatch(/raw colour #abc/);
  });
  it('hex inside the :root token block and in comments is allowed', () => {
    expect(lintSource('app/globals.css', ':root {\n  --sl-x: #123456;\n}\n/* #ff0000 */ .a { color: var(--sl-x); }')).toEqual([]);
    expect(lintSource('components/a.tsx', '<a href="#main">Skip</a>')).toEqual([]);
  });
  it('a bad font fails, the allowed stacks pass', () => {
    expect(lintSource('app/x.css', ".a { font-family: 'Comic Sans MS', sans-serif; }")).toEqual(['app/x.css: font "Comic Sans MS" is not Inter, Inter Display or the mono stack']);
    expect(lintSource('app/x.css', ".a { font-family: 'Inter Display', 'Inter', ui-sans-serif, system-ui, sans-serif; } .b { font-family: var(--font-mono); }")).toEqual([]);
  });
  it('a missing or changed token is reported', () => {
    const r = tmp({ 'app/globals.css': ':root {\n  --sl-ink: #000000;\n}\n' });
    const problems = checkTokens(r, sourceCss);
    expect(problems.join('\n')).toMatch(/token --sl-ink differs/);
    expect(problems.join('\n')).toMatch(/token --sl-navy-900 from the design source is missing/);
  });
});

describe('malva-project-bootstrap › Fonts', () => {
  it('are self-hosted: @font-face sources are local WOFF2 files and no third-party host appears', () => {
    expect(globals).not.toMatch(/fonts\.(googleapis|gstatic)\.com|https?:\/\//);
    const sources = [...globals.matchAll(/@font-face[^}]*url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(sources.length).toBe(6);
    expect(sources.every((s) => s.startsWith('./fonts/') && s.endsWith('.woff2'))).toBe(true);
  });
});

describe('dev pages', () => {
  it('a dev page without the production guard fails', () => {
    expect(checkNoDevPages(tmp({ 'app/[locale]/dev/tokens/page.tsx': 'export default function P() { return null; }' }))).toHaveLength(1);
    expect(checkNoDevPages(tmp({ 'app/[locale]/dev/tokens/page.tsx': "export default function P() { if (process.env.NODE_ENV === 'production') notFound(); return null; }" }))).toEqual([]);
  });
});
