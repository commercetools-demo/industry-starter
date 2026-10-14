// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Design lint: components render from tokens only. No raw colour, font name, px size or Tailwind arbitrary value,
// every var(--x) exists, tokens.css matches the design source, the generated @theme block is current.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOKENS_SOURCE } from './app.config.mjs';
import { buildThemeBlock, currentBlock } from './gen-theme-block.mjs';
import { diffTokens, rootBlock, tokenMap } from './tokens-source.mjs';

export { rootBlock, tokenMap };

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

const FONT_VARS = ['--font-poppins', '--font-archivo', '--font-public-sans', '--font-inter'];
const FONT_TOKEN = { poppins: 'var(--font-display)', archivo: 'var(--font-utility)', 'public sans': 'var(--font-ui)', inter: 'var(--font-button-alt)' };
const EXEMPT = [/(^|\/)app\/(tokens|aa-layer)\.css$/, /\.(test|spec)\.[cm]?[tj]sx?$/, /(^|\/)opengraph-image\.tsx$/, /(^|\/)lib\/theme\/(default-theme|color|shadows)\.ts$/];
const PALETTE = 'slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black';
const PALETTE_CLASS = new RegExp(`(?<![\\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow|decoration|accent|caret)-(?:${PALETTE})(?:-\\d+)?(?![\\w-])`, 'g');

// ---- colour helpers -------------------------------------------------------------------------------------------
function resolve(map, name, depth = 0) {
  const v = map.get(name);
  if (v === undefined || depth > 8) return undefined;
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? resolve(map, ref[1], depth + 1) : v;
}
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  const n = Number.parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function nearestColour(tokens, rgb) {
  let best = null;
  for (const name of tokens.keys()) {
    if (!name.startsWith('--color-')) continue;
    const value = resolve(tokens, name);
    if (!value || !/^#[0-9a-f]{6}$/i.test(value)) continue;
    const c = hexToRgb(value);
    const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (best === null || d < best.d) best = { name, d };
  }
  return best ? `var(${best.name})` : 'a colour token';
}

// ---- px helpers -----------------------------------------------------------------------------------------------
function pxTokens(tokens) {
  const groups = { text: [], space: [], radius: [], other: [] };
  for (const [name, value] of tokens) {
    if (!/^\d+(\.\d+)?px$/.test(value)) continue;
    const px = Number.parseFloat(value);
    const g = name.startsWith('--text-') ? 'text' : name.startsWith('--space-') ? 'space' : name.startsWith('--radius-') ? 'radius' : 'other';
    groups[g].push({ name, px });
  }
  return groups;
}
function suggestPx(tokens, property, px) {
  const groups = pxTokens(tokens);
  const p = property.toLowerCase();
  const pool = /font-?size|line-?height/.test(p) ? groups.text : /radius/.test(p) ? groups.radius : /padding|margin|gap|inset|top|left|right|bottom|space/.test(p) ? groups.space : [...groups.text, ...groups.space, ...groups.radius, ...groups.other];
  const sorted = [...pool].sort((a, b) => Math.abs(a.px - px) - Math.abs(b.px - px));
  const exact = sorted.find((t) => t.px === px);
  if (exact) return `var(${exact.name})`;
  return sorted.slice(0, 3).map((t) => `var(${t.name})`).join(' or ') || 'a size token';
}

// ---- source preparation ---------------------------------------------------------------------------------------
function stripBlocks(text) {
  return text
    .replace(/\/\* fonts:begin[\s\S]*?\/\* fonts:end \*\//g, '')
    .replace(/\/\* theme:begin \*\/[\s\S]*?\/\* theme:end \*\//g, '');
}
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\w'"`])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

/**
 * Lints one source file. `tokens` is the Map from tokenMap(tokens.css); `allow` extra allowed custom properties.
 * Returns problems as strings that name the token to use.
 */
export function lintSource(file, text, tokens, allow = []) {
  const problems = [];
  if (EXEMPT.some((re) => re.test(file.replaceAll('\\', '/')))) return problems;
  const isCss = /\.css$/.test(file);
  const body = stripComments(stripBlocks(text));
  const lines = body.split('\n');
  const at = (index) => body.slice(0, index).split('\n').length;

  // 1. raw colours
  for (const m of body.matchAll(/(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)) {
    const before = body.slice(Math.max(0, m.index - 40), m.index);
    const short = m[0].length <= 5;
    if (!isCss && short && !/(color|background|fill|stroke|border|shadow|bg)/i.test(before)) continue;
    problems.push(`${file}:${at(m.index)}: raw colour ${m[0]}; use ${nearestColour(tokens, hexToRgb(m[0]))}`);
  }
  for (const m of body.matchAll(/\b(rgba?|hsla?|oklch)\(\s*([^)]*)\)/g)) {
    const nums = /^(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(m[2]);
    const hint = m[1].startsWith('rgb') && nums ? nearestColour(tokens, [Number(nums[1]), Number(nums[2]), Number(nums[3])]) : 'a colour token';
    problems.push(`${file}:${at(m.index)}: raw colour ${m[1]}(...); use ${hint}`);
  }

  // 2. raw fonts
  for (const m of body.matchAll(/font-?[fF]amily['"]?\s*:\s*(['"`]?)([^;}\n]+)/g)) {
    const value = m[2].trim().replace(/['"`,]+$/, '');
    if (/^(var\(|inherit$|system-ui$|initial$|unset$)/.test(value)) continue;
    const family = value.split(',')[0].trim().replace(/^['"`]|['"`]$/g, '');
    problems.push(`${file}:${at(m.index)}: font "${family}" is not allowed here; use ${FONT_TOKEN[family.toLowerCase()] ?? 'var(--font-display)'}`);
  }
  for (const m of body.matchAll(/(?<![\w-])font-\[/g)) problems.push(`${file}:${at(m.index)}: arbitrary font class; use font-display, font-body, font-utility, font-ui or font-button-alt`);

  // 3. raw px (not 1px, not in @media/@container conditions, not in sizes="...")
  let offset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    const skipLine = /^@(media|container)\b/.test(trimmed);
    const cleaned = line.replace(/\bsizes\s*=\s*(\{?\s*)(['"`])[^'"`]*\2/g, (s) => ' '.repeat(s.length));
    if (!skipLine) {
      for (const m of cleaned.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)) {
        if (m[1] === '1') continue;
        const before = cleaned.slice(0, m.index);
        const property = /([a-zA-Z-]+)['"]?\s*:\s*['"`]?[^:;]*$/.exec(before)?.[1] ?? '';
        problems.push(`${file}:${at(offset)}: raw size ${m[0]}; use ${suggestPx(tokens, property, Number(m[1]))}`);
      }
    }
    offset += line.length + 1;
  }

  // 4. Tailwind arbitrary values and default-palette classes
  for (const m of body.matchAll(/\[#|\[\d+(?:\.\d+)?px\]|\[rgb/g)) problems.push(`${file}:${at(m.index)}: arbitrary Tailwind value ${m[0]}...]; use a token utility`);
  for (const m of body.matchAll(PALETTE_CLASS)) problems.push(`${file}:${at(m.index)}: class ${m[0]} is not a token; use a token utility such as bg-surface, text-text or border-border`);
  for (const m of body.matchAll(/(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via)-(cream|charcoal|terra|sage)(?:-\w+)?(?![\w-])/g)) problems.push(`${file}:${at(m.index)}: placeholder palette class ${m[0]} is not part of the automotive kit`);

  // 5. unknown variables
  for (const m of body.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const name = m[1];
    if (tokens.has(name) || FONT_VARS.includes(name) || allow.includes(name) || name.startsWith('--tw-')) continue;
    problems.push(`${file}:${at(m.index)}: unknown variable ${name}; use a token from app/tokens.css`);
  }
  return problems;
}

function readAllowlist(root) {
  const f = path.join(root, 'scripts', 'token-allowlist.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
}

export function checkTokens(root, sourcePath = path.resolve(root, TOKENS_SOURCE)) {
  const problems = [];
  const tokensFile = path.join(root, 'app', 'tokens.css');
  const globalsFile = path.join(root, 'app', 'globals.css');
  if (!existsSync(tokensFile)) return ['app/tokens.css is missing'];
  if (!existsSync(globalsFile)) return ['app/globals.css is missing'];
  const tokensCss = readFileSync(tokensFile, 'utf8');
  const globalsCss = readFileSync(globalsFile, 'utf8');
  const tokens = tokenMap(tokensCss);
  const allow = readAllowlist(root);

  // 6. in sync with the design source
  if (!existsSync(sourcePath)) problems.push(`design source ${path.relative(root, sourcePath)} not found; cannot verify the tokens`);
  else {
    const diff = diffTokens(tokensCss, readFileSync(sourcePath, 'utf8'));
    if (diff.length) problems.push(`app/tokens.css differs from the design source (${TOKENS_SOURCE}):`, ...diff.map((d) => `  ${d}`));
  }
  // 7. theme block current
  const block = currentBlock(globalsCss);
  if (block === null) problems.push('app/globals.css has no theme:begin / theme:end block');
  else if (block !== buildThemeBlock(tokensCss)) problems.push('the @theme block in app/globals.css is stale; run node scripts/gen-theme-block.mjs');
  // 9. placeholder palette names as tokens
  for (const [label, css] of [['app/tokens.css', tokensCss], ['app/globals.css', globalsCss]]) {
    for (const m of css.matchAll(/--color-(cream|charcoal|terra|sage)\b/g)) problems.push(`${label}: placeholder palette token ${m[0]} is not part of the automotive kit`);
  }

  const files = ['app', 'components', 'lib']
    .flatMap((d) => walk(path.join(root, d)))
    .filter((f) => /\.(ts|tsx|css)$/.test(f));
  for (const f of files) problems.push(...lintSource(path.relative(root, f), readFileSync(f, 'utf8'), tokens, allow));
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkTokens(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('tokens: OK');
}
