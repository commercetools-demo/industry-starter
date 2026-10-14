/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Generates the `@theme inline` body of app/globals.css from app/tokens.css so the two cannot drift.
// Usage: node scripts/gen-theme-block.mjs          rewrites the block between the theme markers
//        node scripts/gen-theme-block.mjs --check  exits 1 when the committed block is stale
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tokenMap } from './tokens-source.mjs';

export const BEGIN = '/* theme:begin */';
export const END = '/* theme:end */';

const line = (name, value) => `  ${name}: ${value};`;
const self = (name) => line(name, `var(${name})`);

/** The lines between the markers, one utility-facing variable per token. */
export function genThemeBlock(tokensCss) {
  const names = [...tokenMap(tokensCss).keys()];
  const out = [];
  const section = (title, lines) => {
    if (lines.length) out.push(`  /* ${title} */`, ...lines);
  };

  section('colours', names.filter((n) => n.startsWith('--color-')).map(self));
  section('fonts', ['--font-sans', '--font-chart', '--font-mono'].filter((n) => names.includes(n)).map(self));

  const sizes = names.filter((n) => n.startsWith('--text-')).map((n) => n.slice('--text-'.length));
  section(
    'type scale',
    sizes.flatMap((s) => [
      line(`--text-${s}`, `var(--text-${s})`),
      line(`--text-${s}--line-height`, `var(--leading-${s})`),
      line(`--text-${s}--letter-spacing`, `var(--tracking-${s})`),
    ]),
  );
  section(
    'weights',
    names.filter((n) => n.startsWith('--weight-')).map((n) => line(`--font-weight-${n.slice('--weight-'.length)}`, `var(${n})`)),
  );
  section('spacing', [
    ...names.filter((n) => n.startsWith('--space-')).map((n) => line(`--spacing-${n.slice('--space-'.length)}`, `var(${n})`)),
    // layout sizes: w-sidebar, w-sidebar-collapsed, h-topbar, p-widget-padding-y, gap-widget-gap
    ...Object.entries({
      '--sidebar-width': 'sidebar',
      '--sidebar-width-collapsed': 'sidebar-collapsed',
      '--topbar-height': 'topbar',
      '--widget-padding-y': 'widget-padding-y',
      '--widget-gap': 'widget-gap',
    })
      .filter(([n]) => names.includes(n))
      .map(([n, key]) => line(`--spacing-${key}`, `var(${n})`)),
  ]);
  section('radius', names.filter((n) => n.startsWith('--radius-')).map(self));
  section('shadows', names.filter((n) => n.startsWith('--shadow-')).map(self));
  section('blur', names.filter((n) => n.startsWith('--blur-')).map(self));
  section(
    'containers',
    names
      .filter((n) => /^--(page|body|widget)-/.test(n) && !['--widget-padding-y', '--widget-gap'].includes(n))
      .map((n) => line(`--container-${n.slice(2)}`, `var(${n})`)),
  );
  return out.join('\n');
}

/** Replaces the text between the markers in `globals` with `block`. Returns null when the markers are missing. */
export function replaceBlock(globals, block) {
  const start = globals.indexOf(BEGIN);
  const end = globals.indexOf(END);
  if (start < 0 || end < start) return null;
  return `${globals.slice(0, start + BEGIN.length)}\n${block}\n  ${globals.slice(end)}`;
}

/** Returns problems (empty when the committed block equals the generated one). */
export function checkThemeBlock(root) {
  const globalsPath = path.join(root, 'app', 'globals.css');
  const globals = readFileSync(globalsPath, 'utf8');
  const expected = replaceBlock(globals, genThemeBlock(readFileSync(path.join(root, 'app', 'tokens.css'), 'utf8')));
  if (expected === null) return ['app/globals.css lacks the theme:begin / theme:end markers'];
  return expected === globals ? [] : ['app/globals.css theme block is stale; run node scripts/gen-theme-block.mjs'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.cwd();
  if (process.argv.includes('--check')) {
    const problems = checkThemeBlock(root);
    if (problems.length) {
      console.error(problems.join('\n'));
      process.exit(1);
    }
    console.log('theme block: OK');
  } else {
    const globalsPath = path.join(root, 'app', 'globals.css');
    const next = replaceBlock(readFileSync(globalsPath, 'utf8'), genThemeBlock(readFileSync(path.join(root, 'app', 'tokens.css'), 'utf8')));
    if (next === null) {
      console.error('markers missing');
      process.exit(1);
    }
    writeFileSync(globalsPath, next);
    console.log('theme block written');
  }
}
