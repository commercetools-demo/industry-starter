// Design lint (bootstrap-and-structure > Styling from the admin kit): no raw colours, fonts, px sizes or Tailwind
// arbitrary values in source; every var(--x) exists; the local token file matches the design source; the theme block is current.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { TOKENS_SOURCE } from './app.config.mjs';
import { BEGIN as THEME_BEGIN, checkThemeBlock, END as THEME_END } from './gen-theme-block.mjs';
import { runCli, walk } from './fs-utils.mjs';
import { darkBlock, diffTokens, tokenMap } from './tokens-source.mjs';

export { tokenMap };

const FONT_VARS = ['--font-inter'];
const KIT_COLOURS = 'gray|blue|green|azure|purple|red|orange|yellow';
const FOREIGN_COLOURS = 'slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|pink|rose|white|black';
const COLOUR_UTILITIES = 'bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|accent|caret|shadow';

const EXEMPT_FILES = [/^app\/tokens\.css$/, /\.(test|spec)\.[cm]?[tj]sx?$/, /(^|\/)opengraph-image\.tsx$/, /^lib\/theme\/default-theme\.ts$/];
const SCOPE_DIRS = ['app', 'components', 'lib'];

/** Removes the fonts: and theme: blocks of globals.css and comments, keeping line numbers out of scope. */
function stripGenerated(text) {
  return text
    .replace(/\/\* fonts:begin[\s\S]*?\/\* fonts:end \*\//g, '')
    .replace(new RegExp(`${THEME_BEGIN.replace(/[*/]/g, '\\$&')}[\\s\\S]*?${THEME_END.replace(/[*/]/g, '\\$&')}`, 'g'), '');
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** The token whose colour is nearest to `hex` (semantic names win over ramp steps on a tie). */
export function nearestColourToken(hex, tokens) {
  const target = hexToRgb(hex);
  let best = null;
  for (const [name, value] of tokens) {
    if (!name.startsWith('--color-') || !/^#[0-9a-fA-F]{6}$/.test(value)) continue;
    const rgb = hexToRgb(value);
    const d = rgb.reduce((s, c, i) => s + (c - target[i]) ** 2, 0);
    const ramp = /-\d+$/.test(name);
    if (!best || d < best.d || (d === best.d && best.ramp && !ramp)) best = { name, d, ramp };
  }
  return best ? `var(${best.name})` : 'a --color-* token';
}

const SIZE_FAMILIES = [
  { re: /^(font-size|line-height)$/, prefixes: ['--text-', '--leading-'] },
  { re: /^(padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height)(-[a-z]+)*$/, prefixes: ['--space-'] },
  { re: /^border(-[a-z]+)*-radius$/, prefixes: ['--radius-'] },
];

/** Names of tokens with exactly this px value, chosen by the CSS property in `before`. */
export function tokensForPx(px, before, tokens) {
  const prop = /([\w-]+)\s*:\s*[^;{}]*$/.exec(before)?.[1] ?? '';
  const families = SIZE_FAMILIES.filter((f) => f.re.test(prop));
  const prefixes = (families.length ? families : SIZE_FAMILIES).flatMap((f) => f.prefixes);
  const names = [...tokens].filter(([n, v]) => prefixes.some((p) => n.startsWith(p)) && v === px).map(([n]) => n);
  return names.length ? names.slice(0, 3).map((n) => `var(${n})`).join(' or ') : 'a token (no exact match; pick the nearest --space-*, --text-* or --radius-*)';
}

/** Top-level comma split that respects parentheses. */
function splitTop(value) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim().replace(/^['"`]|['"`]$/g, '')).filter(Boolean);
}

/** Violations in one source file. `tokens` is the token map of app/tokens.css. */
export function lintSource(file, text, tokens, { allowlist = [] } = {}) {
  if (EXEMPT_FILES.some((re) => re.test(file))) return [];
  const problems = [];
  const body = stripComments(file === 'app/globals.css' ? stripGenerated(text) : text);

  // 1. raw colours
  for (const m of body.matchAll(/(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b(?![\w-])/g)) {
    const before = body.slice(Math.max(0, m.index - 40), m.index);
    const quoted = /["'`]$/.test(before);
    if (!/\.css$/.test(file) && !quoted && !/(color|background|fill|stroke|border|shadow)/i.test(before)) continue;
    const hex = m[0].length === 9 || m[0].length === 5 ? m[0].slice(0, m[0].length === 9 ? 7 : 4) : m[0];
    problems.push(`${file}: raw colour ${m[0]}; use ${nearestColourToken(hex, tokens)}`);
  }
  for (const m of body.matchAll(/\b(rgba?|hsla?|oklch)\(/g)) problems.push(`${file}: raw colour function ${m[1]}(); use a --color-* token`);

  // 2. raw fonts
  const fontValues = [
    ...[...body.matchAll(/font-family\s*:\s*([^;}]+)/g)].map((m) => m[1]),
    ...[...body.matchAll(/fontFamily\s*:\s*(?:(['"`])([^'"`]*)\1|([^,}\n]+))/g)].map((m) => m[2] ?? m[3]),
  ];
  for (const value of fontValues) {
    for (const family of splitTop(value)) {
      if (/^var\(/.test(family) || family === 'inherit' || family === 'system-ui') continue;
      problems.push(`${file}: font "${family}" is not allowed here; use var(--font-sans) (Inter only)`);
    }
  }
  for (const m of body.matchAll(/\bfont-\[/g)) problems.push(`${file}: arbitrary font utility (${m[0]}); use font-sans`);

  // 3. raw px, minus 1px hairlines, media/container conditions and sizes="" attributes
  const pxBody = body
    .replace(/@(media|container)[^{;]*\{/g, (s) => ' '.repeat(s.length))
    .replace(/sizes=(["'])[^"']*\1/g, (s) => ' '.repeat(s.length))
    .replace(/sizes=\{[^}]*\}/g, (s) => ' '.repeat(s.length));
  for (const m of pxBody.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)) {
    if (m[0] === '1px') continue;
    const before = pxBody.slice(Math.max(0, m.index - 80), m.index);
    problems.push(`${file}: raw size ${m[0]}; use ${tokensForPx(m[0], before.split('\n').pop() ?? before, tokens)}`);
  }

  // 4. Tailwind arbitrary values and the default palette
  for (const m of body.matchAll(/\[(?:#|rgba?\b)[^\]]*\]/g)) problems.push(`${file}: arbitrary colour ${m[0]}; use a token utility`);
  for (const m of body.matchAll(/\[\d+(?:\.\d+)?px\]/g)) problems.push(`${file}: arbitrary size ${m[0]}; use a spacing, radius or text token utility`);
  const foreign = new RegExp(`(?<![\\w-])(${COLOUR_UTILITIES})-(${FOREIGN_COLOURS})(?!-alpha)(-\\d+)?(?![\\w-])`, 'g');
  for (const m of body.matchAll(foreign)) problems.push(`${file}: Tailwind default palette class ${m[0]}; use a token colour (bg-bg-surface, text-text, border-border, ...)`);
  const kit = new RegExp(`(?<![\\w-])(${COLOUR_UTILITIES})-(${KIT_COLOURS})-(\\d+)(?![\\w-])`, 'g');
  for (const m of body.matchAll(kit)) {
    if (Number(m[3]) < 1 || Number(m[3]) > 16) problems.push(`${file}: ${m[0]} is not a kit step (ramps run 1 to 16)`);
  }

  // 5. unknown variables
  const declaredHere = new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const m of body.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const name = m[1];
    if (tokens.has(name) || FONT_VARS.includes(name) || allowlist.includes(name) || declaredHere.has(name) || name.startsWith('--tw-')) continue;
    problems.push(`${file}: unknown variable ${name}; it is not in app/tokens.css`);
  }
  return [...new Set(problems)];
}

/** Every custom property declared anywhere in tokens.css (light and dark). */
function declaredTokens(css) {
  const map = tokenMap(css);
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) if (!map.has(m[1])) map.set(m[1], m[2].trim());
  return map;
}

export function checkTokens(root) {
  const problems = [];
  const tokensPath = path.join(root, 'app', 'tokens.css');
  if (!existsSync(tokensPath)) return ['app/tokens.css is missing'];
  const tokensCss = readFileSync(tokensPath, 'utf8');
  const tokens = declaredTokens(tokensCss);
  const allowFile = path.join(root, 'scripts', 'token-allowlist.json');
  const allowlist = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')) : [];

  const files = SCOPE_DIRS.flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(css|tsx?)$/.test(f));
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    problems.push(...lintSource(rel, readFileSync(f, 'utf8'), tokens, { allowlist }));
  }

  // 6. tokens in sync with the design source
  const sourcePath = path.resolve(root, TOKENS_SOURCE);
  if (!existsSync(sourcePath)) problems.push(`design source ${TOKENS_SOURCE} is missing; cannot verify tokens`);
  else {
    const drift = diffTokens(tokensCss, readFileSync(sourcePath, 'utf8'));
    if (drift.length) problems.push(`app/tokens.css differs from ${TOKENS_SOURCE}:`, ...drift);
  }
  // 7. theme block current
  if (existsSync(path.join(root, 'app', 'globals.css'))) problems.push(...checkThemeBlock(root));
  // 8. the top bar is dark in both themes: the dark block must not redefine it
  if (/--color-bg-topbar\s*:/.test(darkBlock(tokensCss))) problems.push('app/tokens.css: [data-theme="dark"] must not define --color-bg-topbar (the top bar is dark in both themes)');
  return problems;
}

runCli(import.meta.url, checkTokens, 'tokens');
