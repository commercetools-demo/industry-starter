// Computes WCAG contrast ratios for the colour pairs the site uses (V-03). Usage: node scripts/contrast-audit.mjs [--out report.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseTokens(css) {
  const raw = Object.fromEntries([...css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
  const resolve = (v, depth = 0) => { const m = v.match(/^var\((--[\w-]+)\)$/); return m && depth < 6 && raw[m[1]] ? resolve(raw[m[1]], depth + 1) : v; };
  return (name) => resolve(`var(${name})`);
}
const channel = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const luminance = (hex) => { const h = hex.replace('#', ''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
export const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// [description, foreground token, background token, minimum ratio (4.5 text, 3 large text/UI)]
export const PAIRS = [
  ['Body text on white', '--fg1', '--bg', 4.5],
  ['Muted text on white', '--fg2', '--bg', 4.5],
  ['Muted text on section wash', '--fg2', '--bg-muted', 4.5],
  ['Tertiary text on white', '--fg3', '--bg', 4.5],
  ['Navy link on white', '--link-accent', '--bg', 4.5],
  ['Navy link on section wash', '--link-accent', '--bg-muted', 4.5],
  ['White on navy (primary button, CTA band)', '--sl-white', '--sl-navy-900', 4.5],
  ['White on navy hover', '--sl-white', '--sl-navy-950', 4.5],
  ['Navy on white (outline button)', '--sl-navy-900', '--sl-white', 4.5],
  ['White on black (top bar)', '--sl-white', '--sl-black', 4.5],
  ['White on footer dark', '--sl-white', '--sl-ink-2', 4.5],
  ['Footer muted text on footer dark', '--sl-on-dark-muted', '--sl-ink-2', 4.5],
  ['Sample content tag (navy-700 on navy-100)', '--sl-navy-700', '--sl-navy-100', 4.5],
  ['Selected option (navy on tinted surface)', '--sl-navy-900', '--sl-navy-100', 4.5],
  ['Danger text on danger background', '--sl-danger-fg', '--sl-danger-bg', 4.5],
  ['Danger text on white (field errors)', '--sl-danger-fg', '--bg', 4.5],
  ['Success text on success background', '--sl-success-fg', '--sl-success-bg', 4.5],
  // The kit's warn-fg on warn-bg is only 4.3:1, so badges use body ink on the warn background (usage change, token untouched).
  ['Warning badge (ink on warn background)', '--sl-ink', '--sl-warn-bg', 4.5],
  ['Info text on info background', '--sl-info-fg', '--sl-info-bg', 4.5],
  ['Stat caption on dark band', '--sl-gray-250', '--sl-ink', 4.5],
  ['White on dark band', '--sl-white', '--sl-ink', 4.5],
  // The kit's default border (#D1D1D1) is 1.5:1 on white; form controls use the tertiary text grey for their edge (WCAG 1.4.11).
  ['Form control edge on white (3:1)', '--fg3', '--bg', 3],
  ['Focus ring navy on white (3:1)', '--sl-navy-900', '--bg', 3],
];

export function audit(css) {
  const tokenValue = parseTokens(css);
  return PAIRS.map(([name, fg, bg, min]) => { const ratio = contrast(tokenValue(fg), tokenValue(bg)); return { name, fg, bg, min, ratio, pass: ratio >= min }; });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = audit(readFileSync('app/globals.css', 'utf8'));
  const lines = ['# Contrast audit (computed from app/globals.css)', '', '| Pair | Foreground | Background | Ratio | Needs | Result |', '| --- | --- | --- | --- | --- | --- |', ...rows.map((r) => `| ${r.name} | ${r.fg} | ${r.bg} | ${r.ratio.toFixed(2)} | ${r.min} | ${r.pass ? 'pass' : '**FAIL**'} |`)];
  const i = process.argv.indexOf('--out');
  if (i > 0) writeFileSync(process.argv[i + 1], lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  process.exit(rows.some((r) => !r.pass) ? 1 : 0);
}
