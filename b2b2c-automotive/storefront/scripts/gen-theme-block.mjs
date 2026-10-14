// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Generates the `@theme inline` body of app/globals.css from app/tokens.css, so the two never drift.
// Usage: node scripts/gen-theme-block.mjs [--check]   (no flag rewrites the block between the theme markers)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tokenMap } from './tokens-source.mjs';

export const BEGIN = '/* theme:begin */';
export const END = '/* theme:end */';

/** Same-name aliases (`--x: var(--x)`) so Tailwind utilities read the CSS variable at runtime. */
const PASS_THROUGH = [/^--color-(?!accent-gradient$)/, /^--font-/, /^--text-/, /^--leading-/, /^--tracking-/, /^--radius-/, /^--shadow-/];

export function buildThemeBlock(tokensCss) {
  const lines = ['  --color-*: initial; /* the default Tailwind palette is removed */'];
  for (const name of tokenMap(tokensCss).keys()) {
    if (PASS_THROUGH.some((re) => re.test(name))) lines.push(`  ${name}: var(${name});`);
    else if (name.startsWith('--space-')) lines.push(`  --spacing-${name.slice('--space-'.length)}: var(${name});`);
    else if (name === '--content-width') lines.push(`  --container-content: var(${name});`);
    else if (name === '--container-width') lines.push('  --container-page: var(--container-width);');
  }
  return lines.join('\n');
}

export function currentBlock(globalsCss) {
  const start = globalsCss.indexOf(BEGIN);
  const end = globalsCss.indexOf(END);
  if (start < 0 || end < start) return null;
  return globalsCss.slice(start + BEGIN.length, end).replace(/^\n/, '').replace(/\s+$/, '');
}

export function replaceBlock(globalsCss, block) {
  const start = globalsCss.indexOf(BEGIN);
  const end = globalsCss.indexOf(END);
  if (start < 0 || end < start) throw new Error(`globals.css needs ${BEGIN} and ${END} markers`);
  return `${globalsCss.slice(0, start + BEGIN.length)}\n${block}\n  ${globalsCss.slice(end)}`;
}

/** Problems when the committed block differs from the generated one. */
export function themeBlockProblems(globalsCss, tokensCss) {
  const have = currentBlock(globalsCss);
  if (have === null) return ['app/globals.css has no theme:begin / theme:end block'];
  return have === buildThemeBlock(tokensCss) ? [] : ['the @theme block in app/globals.css is stale; run node scripts/gen-theme-block.mjs'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd();
  const globals = path.join(root, 'app', 'globals.css');
  const tokens = readFileSync(path.join(root, 'app', 'tokens.css'), 'utf8');
  const css = readFileSync(globals, 'utf8');
  if (process.argv.includes('--check')) {
    const problems = themeBlockProblems(css, tokens);
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log('theme block: OK');
  } else {
    writeFileSync(globals, replaceBlock(css, buildThemeBlock(tokens)));
    console.log('theme block written');
  }
}
