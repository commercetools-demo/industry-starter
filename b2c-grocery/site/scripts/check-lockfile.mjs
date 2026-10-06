import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];

/** Returns a list of problems (empty when only package-lock.json is used). */
export function checkLockfiles(dir, repoRoot = path.resolve(dir, '..')) {
  const problems = [];
  for (const base of [dir, repoRoot]) {
    for (const name of FORBIDDEN) {
      if (existsSync(path.join(base, name))) problems.push(`${name} found in ${base}; use npm only`);
    }
  }
  if (!existsSync(path.join(dir, 'package-lock.json'))) problems.push('package-lock.json is missing');
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkLockfiles(process.cwd());
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
