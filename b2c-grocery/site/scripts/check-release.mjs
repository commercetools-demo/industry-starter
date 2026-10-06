import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const GUARD = /NODE_ENV\s*(?:===|!==|==|!=)\s*['"]development['"]/;
const NOT_FOUND = /\bnotFound\s*\(/;

/**
 * Release-only checks (used by `verify:release`, not by `verify`). `rootDir` is the project root (site/).
 * Returns a list of problems (empty = releasable).
 */
export function checkRelease(rootDir) {
  const problems = [];
  const appDir = path.join(rootDir, 'app');
  if (existsSync(path.join(appDir, 'api', 'health'))) {
    problems.push('app/api/health must not exist in a release build');
  }
  if (!existsSync(appDir)) return problems;
  for (const file of walk(appDir)) {
    const rel = path.relative(rootDir, file).split(path.sep);
    // Only route/page sources below a `dev` segment of the app directory.
    if (!rel.slice(1, -1).includes('dev')) continue;
    if (/\.test\./.test(rel.at(-1)) || !/\.(ts|tsx|js|jsx|mjs)$/.test(rel.at(-1))) continue;
    const text = readFileSync(file, 'utf8');
    if (!GUARD.test(text) || !NOT_FOUND.test(text)) {
      problems.push(`${rel.join('/')}: dev-only route lacks the NODE_ENV === 'development' guard that calls notFound()`);
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkRelease(process.cwd());
  if (problems.length > 0) {
    console.error(`Release check failed:\n${problems.join('\n')}`);
    process.exit(1);
  }
}
