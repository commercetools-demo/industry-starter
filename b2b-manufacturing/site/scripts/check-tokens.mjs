// Design lint (malva-project-bootstrap › Tokens present): no raw hex colours and no foreign fonts outside the token block,
// and every --sl-* token of the Figma kit exists in globals.css with the same value.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const ALLOWED_FONTS = /^(inter|inter display|ui-sans-serif|system-ui|-apple-system|segoe ui|roboto|helvetica|arial|sans-serif|ui-monospace|sf mono|menlo|consolas|monospace|var\(.*\)|inherit)$/i;

/** The `:root { ... }` block with comments removed. */
export function rootBlock(css) {
  const m = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  return m ? m[1].replace(/\/\*[\s\S]*?\*\//g, '') : '';
}
export function tokenMap(css) {
  const map = new Map();
  for (const m of rootBlock(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  return map;
}

const stripRoot = (css) => css.replace(/:root\s*\{[\s\S]*?\n\}/, '');

/** Social images are drawn by ImageResponse, which cannot read CSS variables, so they carry the brand values. */
const RAW_COLOUR_EXEMPT = /(^|\/)opengraph-image\.tsx$/;

export function lintSource(file, text) {
  const problems = [];
  if (RAW_COLOUR_EXEMPT.test(file)) return problems;
  const body = /\.css$/.test(file) ? stripRoot(text) : text;
  const noComments = body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of noComments.matchAll(/(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b(?![\w-])/g)) {
    // In TSX/TS a bare #abc is rare; skip anchors like href="#main" (only hex-looking colours of 3/4/6/8 digits are flagged).
    if (!/\.css$/.test(file) && /["'`]#[0-9a-fA-F]{3,8}["'`]/.test(m[0]) === false && !/(color|background|fill|stroke|border|shadow)/i.test(noComments.slice(Math.max(0, m.index - 40), m.index))) continue;
    problems.push(`${file}: raw colour ${m[0]}; use a --sl-* token`);
  }
  for (const m of noComments.matchAll(/font-family\s*:\s*([^;}]+)[;}]/g)) {
    for (const part of m[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, ''))) {
      if (part && !ALLOWED_FONTS.test(part)) problems.push(`${file}: font "${part}" is not Inter, Inter Display or the mono stack`);
    }
  }
  return problems;
}

export function checkTokens(root, sourceCssPath) {
  const problems = [];
  const globals = path.join(root, 'app', 'globals.css');
  if (!existsSync(globals)) return ['app/globals.css is missing'];
  const css = readFileSync(globals, 'utf8');
  if (sourceCssPath && existsSync(sourceCssPath)) {
    const mine = tokenMap(css);
    for (const [name, value] of tokenMap(readFileSync(sourceCssPath, 'utf8'))) {
      if (!mine.has(name)) problems.push(`token ${name} from the design source is missing in globals.css`);
      else if (mine.get(name) !== value) problems.push(`token ${name} differs: source "${value}", globals "${mine.get(name)}"`);
    }
  }
  const files = [globals, ...walk(path.join(root, 'app')).filter((f) => /\.(css|tsx?)$/.test(f) && f !== globals), ...walk(path.join(root, 'components')).filter((f) => /\.(css|tsx?)$/.test(f))].filter((f) => !/\.(test|spec)\./.test(f));
  for (const f of files) problems.push(...lintSource(path.relative(root, f), readFileSync(f, 'utf8')));
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = path.resolve(process.cwd(), '..', 'design', 'malva', 'source', 'colors_and_type.css');
  const problems = checkTokens(process.cwd(), source);
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('tokens: OK');
}
