// After `next build`: fails if any server-only env variable NAME appears in the client bundle
// (.next/static). Names only; secrets are never read or printed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECRET_NAMES } from './check-tracked-files.mjs';

export function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function scanBundle(root) {
  const dir = join(root, '.next', 'static');
  const problems = [];
  for (const path of walk(dir)) {
    if (!/\.(js|css|html|json|map)$/.test(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const name of SECRET_NAMES) {
      if (text.includes(name)) problems.push(`${path.slice(root.length + 1)} contains ${name}`);
    }
  }
  return problems;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  const problems = scanBundle(root);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`bundle scan: ${problem}`);
    process.exit(1);
  }
  console.log('bundle scan: ok (no server-only variable names in .next/static)');
}
