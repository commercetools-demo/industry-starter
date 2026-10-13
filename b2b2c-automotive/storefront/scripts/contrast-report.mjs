// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Contrast report (workstream Y, WCAG 1.4.3 and 1.4.11): resolves the automotive kit tokens of app/tokens.css (var() chains, alpha laid
// over the page colour) and checks the pairs of scripts/contrast-pairs.json against 4.5 (normal text), 3 (large text) and 3 (ui).
// A pair with an `exception` is listed, not failed. Only the DEFAULT theme is checked: reseller themes are not contrast-checked by
// decision (theming-design spec, design decision 2).
// Usage: node scripts/contrast-report.mjs [--json]
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const THRESHOLDS = { normal: 4.5, large: 3, ui: 3 };

/** Every `--name: value;` declaration of the `:root` blocks of a stylesheet. */
export function resolveTokens(cssFiles) {
  const map = new Map();
  for (const css of cssFiles) {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/(^|\n)\s*:root\s*\{/g)) {
      let depth = 1;
      let i = m.index + m[0].length;
      const start = i;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth += 1;
        if (text[i] === '}') depth -= 1;
        i += 1;
      }
      for (const d of text.slice(start, i - 1).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(d[1], d[2].trim());
    }
  }
  return map;
}

const lookup = (name, map, seen = new Set()) => {
  if (seen.has(name)) throw new Error(`token cycle at ${name}`);
  seen.add(name);
  const raw = map.get(name);
  if (raw === undefined) throw new Error(`unknown token ${name}`);
  const v = /^var\((--[\w-]+)\)$/.exec(raw);
  return v ? lookup(v[1], map, seen) : raw;
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

/** Evaluates every pair. `bg` may carry alpha: it is laid over `--color-surface-page`; `fg` over the resulting background. */
export function evaluate(pairs, map) {
  const page = parseColour(lookup('--color-surface-page', map));
  return pairs.map((p) => {
    const bg = over(parseColour(lookup(p.bg, map)), page);
    const fg = over(parseColour(lookup(p.fg, map)), bg);
    const need = THRESHOLDS[p.size ?? 'normal'];
    const r = ratio(fg, bg);
    return { ...p, ratio: Math.round(r * 100) / 100, need, pass: r >= need };
  });
}

export function loadReport(cwd) {
  const read = (f) => readFileSync(path.join(cwd, f), 'utf8');
  // The AA layer is read after the kit tokens, as the cascade does.
  const files = [read('app/tokens.css'), ...(existsSync(path.join(cwd, 'app/aa-layer.css')) ? [read('app/aa-layer.css')] : [])];
  return evaluate(JSON.parse(read('scripts/contrast-pairs.json')), resolveTokens(files));
}

export const formatRow = (r) =>
  `${r.pass ? 'PASS' : r.exception ? 'EXCP' : 'FAIL'} ${String(r.ratio).padStart(5)} (>= ${r.need})  ${r.fg} on ${r.bg}  [${r.size ?? 'normal'}]${r.exception ? `  exception: ${r.exception}` : ''}`;

export function checkContrast(cwd) {
  return loadReport(cwd)
    .filter((r) => !r.pass && !r.exception)
    .map((r) => formatRow(r));
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const rows = loadReport(process.cwd());
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) console.log(formatRow(r));
  const failing = rows.filter((r) => !r.pass && !r.exception).length;
  const excepted = rows.filter((r) => !r.pass && r.exception).length;
  console.log(`\n${rows.length} pairs, ${failing} failing, ${excepted} listed exceptions`);
  if (failing) process.exit(1);
}
