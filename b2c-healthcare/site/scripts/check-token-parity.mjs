// Token parity check: design/source/_ds/tokens.css vs app/tokens.css.
// Every custom property of the design file must exist in the storefront file with the
// same value. The "storefront extensions" block (from its marker to the end of the file)
// and the design file's font @import are ignored.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXTENSIONS_MARKER = '==== storefront extensions ====';

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const normalize = (v) => v.replace(/\s+/g, ' ').trim().toLowerCase();

/** Custom properties declared in `css` as a Map(name -> normalized value); last declaration wins. */
export function parseTokens(css) {
  const tokens = new Map();
  const body = stripComments(css).replace(/@import[^;]*;/g, '');
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]?/g)) {
    tokens.set(m[1], normalize(m[2]));
  }
  return tokens;
}

/** Drop the storefront extensions block (the marker lives inside a comment). */
export function stripExtensions(css) {
  const i = css.indexOf(EXTENSIONS_MARKER);
  if (i === -1) return css;
  return css.slice(0, css.lastIndexOf('/*', i));
}

/**
 * @returns {{missing: string[], renamed: {from: string, to: string}[], changed: {name: string, expected: string, actual: string}[], extra: string[]}}
 */
export function compareTokens(sourceCss, storefrontCss) {
  const source = parseTokens(sourceCss);
  const target = parseTokens(stripExtensions(storefrontCss));
  const missing = [];
  const changed = [];
  for (const [name, expected] of source) {
    if (!target.has(name)) missing.push(name);
    else if (target.get(name) !== expected) changed.push({ name, expected, actual: target.get(name) });
  }
  const extraNames = [...target.keys()].filter((n) => !source.has(n));
  // A missing token whose value reappears under exactly one unknown name is reported as a rename.
  const renamed = [];
  const stillMissing = [];
  const usedExtra = new Set();
  for (const name of missing) {
    const candidates = extraNames.filter((n) => !usedExtra.has(n) && target.get(n) === source.get(name));
    if (candidates.length === 1) {
      renamed.push({ from: name, to: candidates[0] });
      usedExtra.add(candidates[0]);
    } else stillMissing.push(name);
  }
  const extra = extraNames.filter((n) => !usedExtra.has(n));
  return { missing: stillMissing, renamed, changed, extra };
}

export function formatReport({ missing, renamed, changed, extra }) {
  const lines = [];
  for (const n of missing) lines.push(`missing token: ${n}`);
  for (const r of renamed) lines.push(`renamed token: ${r.from} -> ${r.to}`);
  for (const c of changed) lines.push(`changed token: ${c.name} (design: ${c.expected}; storefront: ${c.actual})`);
  for (const n of extra) lines.push(`unknown token outside the storefront extensions block: ${n}`);
  return lines;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = readFileSync(resolve(root, '../design/source/_ds/tokens.css'), 'utf8');
  const storefront = readFileSync(resolve(root, 'app/tokens.css'), 'utf8');
  const lines = formatReport(compareTokens(source, storefront));
  if (lines.length > 0) {
    console.error('token parity: FAILED');
    for (const l of lines) console.error(`  ${l}`);
    process.exit(1);
  }
  console.log(`token parity: ok (${parseTokens(source).size} tokens)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
