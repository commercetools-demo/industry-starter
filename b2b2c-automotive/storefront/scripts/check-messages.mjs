// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Message catalogues: exactly de-DE.json and en-US.json, identical keys, no empty values, identical ICU placeholders,
// and every key used in app/, components/ and lib/ exists.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];
const isSource = (f) => /\.(tsx?|jsx?)$/.test(f) && !/\.(test|spec)\./.test(f);

export const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const flatValues = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatValues(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

/** Names of the ICU arguments in a message: `{store}`, `{count, plural, ...}` gives `store`, `count`. */
export const placeholders = (message) => [...new Set([...String(message).matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]))].sort();

/** Keys used through namespaced translators: `const t = useTranslations('ns')`, `await getTranslations({ namespace: 'ns' })`. */
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

const REQUIRED = ['de-DE.json', 'en-US.json'];

export function checkMessages(root) {
  const problems = [];
  const dir = path.join(root, 'messages');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [];
  for (const f of REQUIRED) if (!files.includes(f)) problems.push(`messages/${f} is missing`);
  for (const f of files) if (!REQUIRED.includes(f)) problems.push(`messages/${f} is not allowed: only de-DE.json and en-US.json exist`);
  if (problems.length) return problems;

  const catalogues = Object.fromEntries(REQUIRED.map((f) => [f, JSON.parse(readFileSync(path.join(dir, f), 'utf8'))]));
  const de = catalogues['de-DE.json'];
  const en = catalogues['en-US.json'];
  const deKeys = new Set(flatten(de));
  const enKeys = new Set(flatten(en));
  for (const k of enKeys) if (!deKeys.has(k)) problems.push(`missing in de-DE: ${k}`);
  for (const k of deKeys) if (!enKeys.has(k)) problems.push(`missing in en-US: ${k}`);
  for (const [label, cat] of [['de-DE', de], ['en-US', en]]) {
    for (const [k, v] of flatValues(cat)) if (typeof v !== 'string' || v.trim() === '') problems.push(`empty value in ${label}: ${k}`);
  }
  const enValues = new Map(flatValues(en));
  for (const [k, v] of flatValues(de)) {
    if (!enValues.has(k)) continue;
    const a = placeholders(v).join(',');
    const b = placeholders(enValues.get(k)).join(',');
    if (a !== b) problems.push(`placeholder mismatch for ${k}: de-DE {${a}} vs en-US {${b}}`);
  }
  for (const f of ['app', 'components', 'lib'].flatMap((d) => walk(path.join(root, d))).filter(isSource)) {
    for (const key of usedKeys(readFileSync(f, 'utf8'))) {
      if (!enKeys.has(key)) problems.push(`${path.relative(root, f)} uses missing message key ${key}`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkMessages(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('messages: OK');
}
