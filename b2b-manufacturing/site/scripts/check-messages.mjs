// Message-lookup guard (malva-locale-routing › Message lookup): every t('key') used in app/ and components/ exists in
// messages/en-US.json, and all catalogues have identical keys.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
const isSource = (f) => /\.(tsx?|jsx?)$/.test(f) && !/\.(test|spec)\./.test(f);

export const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

/** Namespaced translators found in a source file: `const t = useTranslations('ns')` / `await getTranslations('ns')` / `{ namespace: 'ns' }`. */
export function usedKeys(source) {
  const keys = [];
  const decl = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(([^)]*)\)/g;
  for (const m of source.matchAll(decl)) {
    const [, name, args] = m;
    // `('ns')`, `({ namespace: 'ns' })` or `({ locale, namespace: 'ns' })`.
    const ns = args.match(/namespace:\s*['"]([\w.]+)['"]/)?.[1] ?? args.trim().match(/^['"]([\w.]+)['"]/)?.[1];
    const call = new RegExp(`\\b${name}(?:\\.(?:rich|raw|markup|has))?\\(\\s*['"]([\\w.]+)['"]`, 'g');
    for (const c of source.matchAll(call)) keys.push(ns ? `${ns}.${c[1]}` : c[1]);
  }
  return keys;
}

export function checkMessages(root) {
  const problems = [];
  const dir = path.join(root, 'messages');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  if (!files.includes('en-US.json')) return ['messages/en-US.json is missing'];
  const catalogues = Object.fromEntries(files.map((f) => [f, new Set(flatten(JSON.parse(readFileSync(path.join(dir, f), 'utf8'))))]));
  const base = catalogues['en-US.json'];
  for (const [file, keys] of Object.entries(catalogues)) {
    if (file === 'en-US.json') continue;
    for (const k of base) if (!keys.has(k)) problems.push(`${file} lacks key ${k}`);
    for (const k of keys) if (!base.has(k)) problems.push(`${file} has extra key ${k}`);
  }
  for (const f of [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))].filter(isSource)) {
    for (const key of usedKeys(readFileSync(f, 'utf8'))) if (!base.has(key)) problems.push(`${path.relative(root, f)} uses missing message key ${key}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkMessages(process.cwd());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('messages: OK');
}
