import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSIONS_MARKER = '/* ==== storefront extensions';
const FONT_TOKENS = {
  '--font-display': '--font-exo',
  '--font-cta': '--font-inter',
  '--font-body': '--font-roboto',
};
const DESIGN_FONTS = new Set(['Exo', 'Inter', 'Roboto']);
const ALLOWED_RAW_FILES = new Set(['app/globals.css']);

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalise(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => hex.toLowerCase());
}

/** Returns the text between the braces of the first block that starts with `opener`. */
function blockAfter(css, opener) {
  const start = css.indexOf(opener);
  if (start === -1) return undefined;
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
    }
  }
  return undefined;
}

function declarations(css) {
  const map = new Map();
  for (const match of stripComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], normalise(match[2]));
  }
  return map;
}

/**
 * Compares the Tailwind theme with the design token file.
 * @param {string} designCss contents of design/source/_ds/tokens.css
 * @param {string} themeCss contents of app/globals.css
 * @returns {string[]} problems (empty = parity)
 */
export function checkTokenParity(designCss, themeCss) {
  const problems = [];
  const design = declarations(blockAfter(designCss, ':root') ?? '');
  const themeBlock = blockAfter(themeCss, '@theme static') ?? '';
  const markerAt = themeBlock.indexOf(EXTENSIONS_MARKER);
  const designPart = declarations(markerAt === -1 ? themeBlock : themeBlock.slice(0, markerAt));
  const extensionPart = declarations(markerAt === -1 ? '' : themeBlock.slice(markerAt));

  for (const [name, value] of design) {
    const actual = designPart.get(name);
    if (actual === undefined) {
      problems.push(`token ${name} is missing from the theme`);
      continue;
    }
    const expected = name in FONT_TOKENS ? `var(${FONT_TOKENS[name]}),${value}` : value;
    if (actual !== expected) problems.push(`token ${name} differs: design "${expected}" vs theme "${actual}"`);
  }
  for (const name of designPart.keys()) {
    if (!design.has(name)) {
      problems.push(`token ${name} is in the design part of the theme but not in tokens.css (rename or move below the extensions line)`);
    }
  }
  for (const name of extensionPart.keys()) {
    if (design.has(name)) problems.push(`extension ${name} reuses a design token name`);
  }
  if (themeCss.includes('fonts.googleapis.com')) problems.push('fonts: found fonts.googleapis.com in app/globals.css');
  return problems;
}

function walk(dir, siteDir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, siteDir, files);
    else files.push(path.relative(siteDir, full).split(path.sep).join('/'));
  }
  return files;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

const LIGHT_BRAND_BG = /(?<![\w-])bg-(?:brand-(?:50|100|200|300|400|500)|surface-brand-subtle|surface-brand)(?![\w-])/;

/**
 * Scans app/ and components/ for departures from the design tokens.
 * @param {string} siteDir the site directory
 * @returns {string[]} problems (empty = clean)
 */
export function findDesignViolations(siteDir) {
  const problems = [];
  const files = [...walk(path.join(siteDir, 'app'), siteDir), ...walk(path.join(siteDir, 'components'), siteDir)];
  for (const rel of files) {
    const isTest = /\.test\.[cm]?[jt]sx?$/.test(rel);
    const isLabel = rel.startsWith('components/label/');
    const isCss = rel.endsWith('.css');
    const isSource = /\.(?:ts|tsx)$/.test(rel);
    if (!isCss && !isSource) continue;
    if (isTest) continue;
    const text = readFileSync(path.join(siteDir, rel), 'utf8');

    if (isCss && !ALLOWED_RAW_FILES.has(rel) && !isLabel) {
      text.split('\n').forEach((line, index) => {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\d+px/.test(line)) problems.push(`${rel}:${index + 1}: raw value`);
      });
    }
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(text)) {
      problems.push(`${rel}: fonts: Google Fonts hosts are not allowed, fonts are self-hosted through next/font`);
    }
    if (!isSource) continue;
    for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]next\/font\/google['"]/g)) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0];
        if (name && !DESIGN_FONTS.has(name)) problems.push(`fonts: ${name} is not a design font (${rel})`);
      }
    }
    if (rel.endsWith('.tsx') && !isLabel) {
      for (const match of text.matchAll(/(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g)) {
        const literal = match[0];
        const line = lineOf(text, match.index);
        if (/(?<![\w-])text-(?:white|neutral-0)(?![\w-])/.test(literal)) {
          problems.push(`${rel}:${line}: use text-text-on-pink on pink-700 or darker, text-text-on-brand on brand surfaces, never white`);
        }
        if (/(?<![\w-])text-text-on-pink(?![\w-])/.test(literal) && LIGHT_BRAND_BG.test(literal)) {
          problems.push(`${rel}:${line}: text-on-pink on a light brand surface`);
        }
      }
    }
  }
  return problems;
}

/**
 * Runs token parity and the design-violation scan for a site directory.
 * @param {string} siteDir the site directory
 * @returns {string[]} problems (empty = pass)
 */
export function checkTokens(siteDir) {
  const designCss = readFileSync(path.join(siteDir, '..', 'design', 'source', '_ds', 'tokens.css'), 'utf8');
  const themeCss = readFileSync(path.join(siteDir, 'app', 'globals.css'), 'utf8');
  return [...checkTokenParity(designCss, themeCss), ...findDesignViolations(siteDir)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkTokens(process.cwd());
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
