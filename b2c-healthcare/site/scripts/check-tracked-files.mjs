// Fails if a real env file or build output is tracked by the VCS, or if the scanned secrets
// appear with a NEXT_PUBLIC_ prefix in any tracked file. Run from anywhere inside the repo.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECRET_NAMES = [
  'CTP_PROJECT_KEY',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_SCOPES',
  'SESSION_SECRET',
];

const ALLOWED_ENV_FILES = new Set(['.env.example', '.env.seed.example']);

/** Env files and build output that must never be tracked. */
export function forbiddenTracked(paths) {
  return paths.filter((path) => {
    const name = basename(path);
    if (name.startsWith('.env') && !ALLOWED_ENV_FILES.has(name)) return true;
    return path.split('/').includes('.next');
  });
}

/** Names of the form <public prefix><secret> (any public-prefixed CTP variable is also caught). */
export function publicPrefixHits(text) {
  const prefix = 'NEXT_PUBLIC_';
  const hits = [];
  for (const name of SECRET_NAMES) {
    if (text.includes(prefix + name)) hits.push(prefix + name);
  }
  if (new RegExp(`${prefix}CTP_`).test(text)) hits.push(`${prefix}CTP_*`);
  return [...new Set(hits)];
}

export function trackedFiles(cwd) {
  const out = execFileSync('git', ['ls-files', '-z', '--', '.'], { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  return out.split('\0').filter(Boolean);
}

export function scanTracked(cwd) {
  const problems = [];
  const files = trackedFiles(cwd);
  for (const path of forbiddenTracked(files)) problems.push(`tracked file must not be committed: ${path}`);
  for (const path of files) {
    if (path === 'package-lock.json' || /\.(ico|png|jpe?g|webp|woff2?)$/.test(path)) continue;
    let text;
    try {
      text = readFileSync(resolve(cwd, path), 'utf8');
    } catch {
      continue;
    }
    for (const hit of publicPrefixHits(text)) problems.push(`${path}: forbidden public variable ${hit}`);
  }
  return problems;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const cwd = resolve(fileURLToPath(import.meta.url), '..', '..');
  let problems;
  try {
    problems = scanTracked(cwd);
  } catch (error) {
    console.log(`tracked-files check skipped (no git repository): ${error.message.split('\n')[0]}`);
    process.exit(0);
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`tracked-files: ${problem}`);
    process.exit(1);
  }
  console.log('tracked-files: ok');
}
