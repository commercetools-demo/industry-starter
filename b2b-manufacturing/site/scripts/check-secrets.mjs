// Secrets and environment files (malva-project-bootstrap › No public prefix on secrets, Nothing committed).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SECRET_VARS = ['CTP_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_SCOPES', 'CTP_DEFAULT_STORE_KEY', 'CTP_PROV_CLIENT_ID', 'CTP_PROV_CLIENT_SECRET', 'CTP_PROV_SCOPES', 'SESSION_SECRET'];
const SKIP = new Set(['node_modules', '.next', '.git', 'coverage']);
const walk = (dir) => readdirSync(dir).flatMap((f) => { if (SKIP.has(f)) return []; const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

/** `tracked` is injectable for tests; by default it is `git ls-files` (empty outside a repository). */
export function checkSecrets(root, tracked = gitTracked(root)) {
  const problems = [];
  const pattern = new RegExp(`NEXT_PUBLIC_(${SECRET_VARS.join('|')}|[A-Z_]*(SECRET|PASSWORD|TOKEN))`);
  for (const f of walk(root)) {
    if (/\.(test|spec)\.[cm]?[tj]sx?$/.test(f) || path.basename(f) === 'check-secrets.mjs' || !/\.(m?[jt]sx?|json|md|env.*|example)$/.test(f) && !path.basename(f).startsWith('.env')) continue;
    if (pattern.test(readFileSync(f, 'utf8'))) problems.push(`${path.relative(root, f)}: a secret must never carry the NEXT_PUBLIC_ prefix`);
  }
  for (const f of tracked) if (/(^|\/)\.env($|\.(?!example$))/.test(f) || /(^|\/)\.next\//.test(f)) problems.push(`${f} is tracked by git`);
  if (!existsSync(path.join(root, '.env.example'))) problems.push('.env.example is missing');
  else {
    const example = readFileSync(path.join(root, '.env.example'), 'utf8');
    for (const v of SECRET_VARS) if (!new RegExp(`^${v}=\\s*$`, 'm').test(example)) problems.push(`.env.example must list ${v}= with no value`);
  }
  return problems;
}

function gitTracked(root) {
  try { return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return []; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkSecrets(process.cwd());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('secrets: OK');
}
