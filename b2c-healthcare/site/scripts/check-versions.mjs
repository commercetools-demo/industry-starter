// Version gate: fails if the installed `next` is below 16.0.0 or `next-intl` is below 4.0.0.
// Reads the installed packages in node_modules (not package.json ranges).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MINIMUMS = { next: '16.0.0', 'next-intl': '4.0.0' };

export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`Cannot compare versions "${a}" and "${b}"`);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** Returns a list of human-readable problems; empty when the gate passes. */
export function checkVersions(root, minimums = MINIMUMS) {
  const problems = [];
  for (const [name, minimum] of Object.entries(minimums)) {
    let installed;
    try {
      const pkg = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));
      installed = pkg.version;
    } catch {
      problems.push(`${name} is not installed (need >= ${minimum})`);
      continue;
    }
    if (!parseVersion(installed)) {
      problems.push(`${name} has an unreadable version "${installed}"`);
    } else if (compareVersions(installed, minimum) < 0) {
      problems.push(`${name}@${installed} is below the required ${minimum}`);
    }
  }
  return problems;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  const problems = checkVersions(root);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`version gate: ${problem}`);
    process.exit(1);
  }
  console.log('version gate: ok');
}
