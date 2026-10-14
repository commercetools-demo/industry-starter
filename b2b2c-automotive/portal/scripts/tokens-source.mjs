/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Token file helpers: the local app/tokens.css is a copy of the design source minus the Google Fonts @import (Q-B01).

/** Removes the Google Fonts @import line, normalises line endings and ensures exactly one trailing newline. */
export function normalise(css) {
  return (
    css
      .replace(/\r\n/g, '\n')
      .replace(/^@import url\("https:\/\/fonts\.googleapis\.com[^\n]*\n/gm, '')
      .replace(/\n*$/, '') + '\n'
  );
}

/** Returns the first 20 differing lines as `-`/`+` pairs (empty when both files are equal after normalising). */
export function diffTokens(local, source) {
  const a = normalise(local).split('\n');
  const b = normalise(source).split('\n');
  const out = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len && out.length < 20; i += 1) {
    if (a[i] === b[i]) continue;
    if (b[i] !== undefined) out.push(`- line ${i + 1}: ${b[i]}`);
    if (a[i] !== undefined) out.push(`+ line ${i + 1}: ${a[i]}`);
  }
  return out.slice(0, 20);
}

/** The `:root { ... }` block with comments removed. */
export function rootBlock(css) {
  const m = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  return m ? m[1].replace(/\/\*[\s\S]*?\*\//g, '') : '';
}

/** Map of custom property name to value for the `:root` block. */
export function tokenMap(css) {
  const map = new Map();
  for (const m of rootBlock(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  return map;
}

/** The body of the `[data-theme="dark"]` block, comments removed. */
export function darkBlock(css) {
  const m = /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css);
  return m ? m[1].replace(/\/\*[\s\S]*?\*\//g, '') : '';
}
