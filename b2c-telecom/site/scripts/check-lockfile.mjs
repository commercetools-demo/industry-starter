import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FOREIGN_LOCKFILES = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];

/**
 * Returns the list of lockfile problems (empty = pass). npm is the only supported package manager.
 * @param {string} dir the site directory
 * @param {string} [repoRoot] defaults to the parent of dir
 * @returns {string[]}
 */
export function checkLockfiles(dir, repoRoot = path.resolve(dir, '..')) {
  const problems = [];
  for (const where of new Set([dir, repoRoot])) {
    for (const file of FOREIGN_LOCKFILES) {
      if (existsSync(path.join(where, file))) {
        problems.push(`${file} found in ${where}; use npm only`);
      }
    }
  }
  if (!existsSync(path.join(dir, 'package-lock.json'))) {
    problems.push('package-lock.json is missing');
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkLockfiles(process.cwd());
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
