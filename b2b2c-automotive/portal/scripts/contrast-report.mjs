// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Contrast report (workstream Y, WCAG 1.4.3 and 1.4.11): resolves the admin kit tokens of app/tokens.css plus the AA layer of
// app/globals.css (var() chains, the [data-theme="dark"] overrides, alpha over the page colour) and checks the pairs of
// scripts/contrast-pairs.json against 4.5 (normal text), 3 (large text) and 3 (ui). A pair with an `exception` is listed, not failed.
// Usage: node scripts/contrast-report.mjs [--json]
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const THRESHOLDS = { normal: 4.5, large: 3, ui: 3 };

/** Bodies of every top-level `selector { ... }` block whose selector is `:root` or `[data-theme="dark"]`, in file order. */
export function themeBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  for (const m of text.matchAll(/(^|[\s}])(:root|\[data-theme="dark"\])\s*\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth += 1;
      if (text[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ mode: m[2] === ':root' ? 'light' : 'dark', body: text.slice(start, i - 1) });
  }
  return blocks;
}

/**
 * Token maps for both modes, following the cascade: `:root` and `[data-theme="dark"]` weigh the same, so under `data-theme="dark"`
 * the last block in file order wins. A `:root` block that follows the dark block of tokens.css therefore also overrides it in dark
 * unless the dark selector is repeated after it (which is why the AA layer of globals.css restates its tokens in dark).
 */
export function resolveModes(cssFiles) {
  const light = new Map();
  const dark = new Map();
  for (const css of cssFiles) {
    for (const { mode, body } of themeBlocks(css)) {
      for (const d of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        if (mode === 'light') light.set(d[1], d[2].trim());
        dark.set(d[1], d[2].trim());
      }
    }
  }
  return { light, dark };
}

const lookup = (name, mode, maps, seen = new Set()) => {
  if (seen.has(name)) throw new Error(`token cycle at ${name}`);
  seen.add(name);
  const raw = (mode === 'dark' && maps.dark.get(name)) || maps.light.get(name);
  if (raw === undefined) throw new Error(`unknown token ${name}`);
  const v = /^var\((--[\w-]+)\)$/.exec(raw);
  return v ? lookup(v[1], mode, maps, seen) : raw;
};

export function parseColour(value) {
  const m = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (!m) throw new Error(`unsupported colour ${value}`);
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

const over = (top, base) => ({
  r: top.r * top.a + base.r * (1 - top.a),
  g: top.g * top.a + base.g * (1 - top.a),
  b: top.b * top.a + base.b * (1 - top.a),
  a: 1,
});

const lum = ({ r, g, b }) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export function ratio(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Evaluates every pair in every mode it applies to. `bg` may carry alpha: it is laid over `page` (`--color-bg-page`). */
export function evaluate(pairs, maps) {
  const rows = [];
  for (const p of pairs) {
    for (const mode of p.where === 'both' || !p.where ? ['light', 'dark'] : [p.where]) {
      const page = parseColour(lookup('--color-bg-page', mode, maps));
      const bg = over(parseColour(lookup(p.bg, mode, maps)), page);
      const fg = over(parseColour(lookup(p.fg, mode, maps)), bg);
      const need = THRESHOLDS[p.size ?? 'normal'];
      const r = ratio(fg, bg);
      rows.push({ ...p, mode, ratio: Math.round(r * 100) / 100, need, pass: r >= need });
    }
  }
  return rows;
}

export function loadReport(cwd) {
  const read = (f) => readFileSync(path.join(cwd, f), 'utf8');
  const maps = resolveModes([read('app/tokens.css'), read('app/globals.css')]);
  const pairs = JSON.parse(read('scripts/contrast-pairs.json'));
  return evaluate(pairs, maps);
}

export const formatRow = (r) =>
  `${r.pass ? 'PASS' : r.exception ? 'EXCP' : 'FAIL'}  ${r.mode.padEnd(5)} ${String(r.ratio).padStart(5)} (>= ${r.need})  ${r.fg} on ${r.bg}  [${r.size ?? 'normal'}]${r.exception ? `  exception: ${r.exception}` : ''}`;

export function checkContrast(cwd) {
  return loadReport(cwd)
    .filter((r) => !r.pass && !r.exception)
    .map((r) => formatRow(r));
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const rows = loadReport(process.cwd());
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows.filter((x) => !process.argv.includes('--summary') || (!x.pass && !x.exception))) console.log(formatRow(r));
  const failing = rows.filter((r) => !r.pass && !r.exception).length;
  const excepted = rows.filter((r) => !r.pass && r.exception).length;
  console.log(`\n${rows.length} pair checks, ${failing} failing, ${excepted} listed exceptions`);
  if (failing) process.exit(1);
}
