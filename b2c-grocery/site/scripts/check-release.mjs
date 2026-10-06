import { execFileSync } from 'node:child_process';
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

/** The `netlify.toml` the repository must carry (Y-01). Compared ignoring blank lines and spacing. */
export const NETLIFY_TEMPLATE = `[build]
  base    = "site"
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "22"
`;

const normalize = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');

/** Files tracked by git below `rootDir`; empty outside a git checkout. */
function trackedFiles(rootDir) {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Release-only checks (used by `verify:release`, not by `verify`). `rootDir` is the project root (site/); the
 * repository root is its parent. Returns a list of problems (empty = releasable).
 */
export function checkRelease(rootDir) {
  const problems = [];
  const repoRoot = path.resolve(rootDir, '..');

  const netlifyFile = path.join(repoRoot, 'netlify.toml');
  if (!existsSync(netlifyFile)) {
    problems.push('netlify.toml is missing at the repository root');
  } else if (normalize(readFileSync(netlifyFile, 'utf8')) !== normalize(NETLIFY_TEMPLATE)) {
    problems.push('netlify.toml does not match the template (base site, command npm run build, publish .next, NODE_VERSION 22)');
  }
  for (const dir of [repoRoot, rootDir]) {
    if (existsSync(path.join(dir, 'vercel.json'))) problems.push('vercel.json must not exist (hosting is Netlify, D-003)');
  }
  for (const file of trackedFiles(rootDir)) {
    const base = path.basename(file);
    if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') problems.push(`${file}: environment files must not be tracked`);
  }

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
