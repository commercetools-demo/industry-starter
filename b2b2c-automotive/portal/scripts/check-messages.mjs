/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Message gate (bootstrap-and-structure > Locale routing for two locales, Gates and tests): exactly two catalogs with
// identical keys and placeholders, no empty values, and every t('ns.key') used in source exists in en-US.json.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isTest, runCli, walk } from './fs-utils.mjs';

const isSource = (f) => /\.(tsx?|jsx?)$/.test(f) && !isTest(f);

export const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

/** ICU argument names in a message, e.g. `{store}` and `{count, plural, ...}` give store and count. */
export function placeholders(text) {
  return [...new Set([...String(text).matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map((m) => m[1]))].sort();
}

/** Keys used through namespaced translators: `const t = useTranslations('ns')` / `await getTranslations({ namespace: 'ns' })`. */
export function usedKeys(source) {
  const keys = [];
  const decl = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(([^)]*)\)/g;
  for (const m of source.matchAll(decl)) {
    const [, name, args] = m;
    const ns = args.match(/namespace:\s*['"]([\w.]+)['"]/)?.[1] ?? args.trim().match(/^['"]([\w.]+)['"]/)?.[1];
    const call = new RegExp(`\\b${name}(?:\\.(?:rich|raw|markup|has))?\\(\\s*['"]([\\w.]+)['"]`, 'g');
    for (const c of source.matchAll(call)) keys.push(ns ? `${ns}.${c[1]}` : c[1]);
  }
  return keys;
}

export function checkMessages(root) {
  const problems = [];
  const dir = path.join(root, 'messages');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  for (const required of ['de-DE.json', 'en-US.json']) if (!files.includes(required)) problems.push(`messages/${required} is missing`);
  for (const f of files) if (!['de-DE.json', 'en-US.json'].includes(f)) problems.push(`messages/${f}: only de-DE and en-US catalogs are allowed`);
  if (problems.length) return problems;

  const read = (f) => new Map(flatten(JSON.parse(readFileSync(path.join(dir, f), 'utf8'))));
  const de = read('de-DE.json');
  const en = read('en-US.json');
  for (const k of de.keys()) if (!en.has(k)) problems.push(`missing in en-US: ${k}`);
  for (const k of en.keys()) if (!de.has(k)) problems.push(`missing in de-DE: ${k}`);
  for (const [name, catalog] of [['de-DE', de], ['en-US', en]]) {
    for (const [k, v] of catalog) if (typeof v !== 'string' || v.trim() === '') problems.push(`empty value in ${name}: ${k}`);
  }
  for (const [k, v] of en) {
    if (de.has(k) && placeholders(v).join() !== placeholders(de.get(k)).join()) {
      problems.push(`placeholder mismatch for ${k}: en-US {${placeholders(v).join(', ')}} vs de-DE {${placeholders(de.get(k)).join(', ')}}`);
    }
  }
  for (const dirName of ['app', 'components', 'lib']) {
    for (const f of walk(path.join(root, dirName)).filter(isSource)) {
      for (const key of usedKeys(readFileSync(f, 'utf8'))) if (!en.has(key)) problems.push(`${path.relative(root, f)} uses missing message key ${key}`);
    }
  }
  return problems;
}

runCli(import.meta.url, checkMessages, 'messages');
