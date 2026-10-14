// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Token file sync: app/tokens.css must equal the design source except for the Google Fonts @import line
// (fonts are self-hosted through next/font, see Q-B01).

/** Removes the Google Fonts @import line, normalises line endings and the trailing newline. */
export function normalise(css) {
  return (
    css
      .replace(/\r\n/g, '\n')
      .replace(/^@import url\("https:\/\/fonts\.googleapis\.com[^\n]*\n/m, '')
      .replace(/\s+$/, '') + '\n'
  );
}

/** The `:root { ... }` body of a token file with comments removed. */
export function rootBlock(css) {
  const m = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
  return m ? m[1].replace(/\/\*[\s\S]*?\*\//g, '') : '';
}

/** Map of custom property name to its value (whitespace collapsed). */
export function tokenMap(css) {
  const map = new Map();
  for (const m of rootBlock(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  return map;
}

/** Returns the first 20 differing lines as `-`/`+` pairs (empty array when both files are equal after normalising). */
export function diffTokens(local, source) {
  const a = normalise(local).split('\n');
  const b = normalise(source).split('\n');
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length) && out.length < 20; i += 1) {
    if (a[i] !== b[i]) {
      out.push(`line ${i + 1}: - ${b[i] ?? '(missing in source)'}`);
      out.push(`line ${i + 1}: + ${a[i] ?? '(missing locally)'}`);
    }
  }
  return out.slice(0, 20);
}
