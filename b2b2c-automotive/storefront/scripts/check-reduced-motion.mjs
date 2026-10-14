// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Reduced motion gate (workstream Y, WCAG 2.3.3): one global `@media (prefers-reduced-motion: reduce)` rule in app/globals.css
// switches animation, transition and smooth scrolling off, nothing scrolls smoothly outside it, an `animate-*` utility is always
// `motion-safe:`, and nothing auto-plays (a carousel or video would need a pause control, WCAG 2.2.2).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const GLOBAL_CSS = 'app/globals.css';
const SKIP = new Set(['node_modules', '.next', '.git']);
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        if (SKIP.has(f)) return [];
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];
const isTest = (f) => /\.(test|spec)\.[cm]?[tj]sx?$/.test(f);

/** The body of the `@media (prefers-reduced-motion: reduce)` blocks of a stylesheet, joined. */
export function reducedMotionRules(css) {
  const out = [];
  for (const m of css.matchAll(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

export function checkReducedMotion(cwd) {
  const problems = [];
  const cssPath = path.join(cwd, GLOBAL_CSS);
  const rule = existsSync(cssPath) ? reducedMotionRules(readFileSync(cssPath, 'utf8')) : '';
  if (!rule) problems.push(`${GLOBAL_CSS}: missing the global @media (prefers-reduced-motion: reduce) rule`);
  else {
    if (!/animation-duration\s*:\s*0?\.?0*1ms\s*!important/.test(rule) && !/animation\s*:\s*none\s*!important/.test(rule)) problems.push(`${GLOBAL_CSS}: the reduced-motion rule must shorten animation-duration to ~0 (!important)`);
    if (!/transition-duration\s*:\s*0?\.?0*1ms\s*!important/.test(rule) && !/transition\s*:\s*none\s*!important/.test(rule)) problems.push(`${GLOBAL_CSS}: the reduced-motion rule must shorten transition-duration to ~0 (!important)`);
    if (!/scroll-behavior\s*:\s*auto\s*!important/.test(rule)) problems.push(`${GLOBAL_CSS}: the reduced-motion rule must set scroll-behavior: auto (!important)`);
  }
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of walk(path.join(cwd, dir))) {
      if (isTest(file) || !/\.(tsx?|css)$/.test(file)) continue;
      const rel = path.relative(cwd, file);
      const text = readFileSync(file, 'utf8');
      const css = rel.endsWith('.css') ? text.replace(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{[\s\S]*?\n\}/g, '') : text;
      if (/scroll-smooth|scroll-behavior\s*:\s*smooth|behavior\s*:\s*['"]smooth['"]/.test(css)) problems.push(`${rel}: smooth scrolling is not allowed (it is not guarded by prefers-reduced-motion)`);
      for (const m of text.matchAll(/(^|[\s"'`])(?!motion-safe:)([\w:-]*:)?animate-(?!none)[\w-]+/g)) {
        if (!m[0].includes('motion-safe:')) problems.push(`${rel}: animation utility "${m[0].trim()}" must be written motion-safe:animate-*`);
      }
      if (/\bautoPlay\b|\bautoplay\b/.test(text)) problems.push(`${rel}: auto-playing media or carousel needs a pause control (WCAG 2.2.2); none exists`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const problems = checkReducedMotion(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('reduced-motion: OK');
}
