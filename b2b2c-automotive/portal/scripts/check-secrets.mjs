// Secrets and environment files (bootstrap-and-structure > Environment and least privilege).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SECRET_VARS } from './app.config.mjs';
import { isTest, runCli, walk } from './fs-utils.mjs';

const SCOPE_RE = /^#\s*((?:view|manage|create)_[a-z_]+)\s*(?::\s*(.*))?$/;
const SOURCE_DIRS = ['app', 'lib', 'components', 'hooks', 'context'];

/** Documented scopes per `*_SCOPES` variable plus problems found in the comment blocks. */
export function parseScopeBlocks(example) {
  const blocks = {};
  const problems = [];
  let comments = [];
  for (const line of example.split('\n')) {
    if (line.startsWith('#')) {
      comments.push(line.trim());
      continue;
    }
    const m = /^([A-Z_]*_SCOPES)=/.exec(line);
    if (m) {
      blocks[m[1]] = [];
      for (const c of comments) {
        const s = SCOPE_RE.exec(c);
        if (!s) continue;
        if (!s[2] || !s[2].trim()) problems.push(`${m[1]}: scope ${s[1]} has an empty reason (use "# ${s[1]} : <reason>")`);
        else blocks[m[1]].push(s[1]);
      }
    }
    comments = [];
  }
  return { blocks, problems };
}

/** `tracked` is injectable for tests; by default it is `git ls-files` (empty outside a repository). */
export function checkSecrets(root, tracked = gitTracked(root)) {
  const problems = [];
  const pattern = new RegExp(`NEXT_PUBLIC_(${SECRET_VARS.join('|')}|[A-Z_]*(SECRET|PASSWORD|TOKEN))`);
  for (const f of walk(root)) {
    const base = path.basename(f);
    if (isTest(f) || base === 'check-secrets.mjs' || base === 'app.config.mjs') continue;
    if (!/\.(m?[jt]sx?|json|md)$/.test(f) && !base.startsWith('.env')) continue;
    if (pattern.test(readFileSync(f, 'utf8'))) problems.push(`${path.relative(root, f)}: a secret must never carry the NEXT_PUBLIC_ prefix`);
  }
  for (const f of tracked) {
    if (/(^|\/)\.env($|\.(?!example$))/.test(f) || /(^|\/)\.next\//.test(f)) problems.push(`${f} is tracked by git`);
  }
  const examplePath = path.join(root, '.env.example');
  if (!existsSync(examplePath)) return [...problems, '.env.example is missing'];

  const example = readFileSync(examplePath, 'utf8');
  for (const v of SECRET_VARS) {
    if (!new RegExp(`^${v}=\\s*$`, 'm').test(example)) problems.push(`.env.example must list ${v}= with no value`);
  }
  const { blocks, problems: blockProblems } = parseScopeBlocks(example);
  problems.push(...blockProblems);

  // A scope used by code but missing from every *_SCOPES block is undocumented.
  const documented = new Set(Object.values(blocks).flat());
  for (const dir of SOURCE_DIRS) {
    for (const f of walk(path.join(root, dir)).filter((x) => /\.[tj]sx?$/.test(x) && !isTest(x))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/['"`]((?:view|manage|create)_[a-z_]+)(?::[\w-]+)?['"`]/g)) {
        if (!documented.has(m[1])) problems.push(`${path.relative(root, f)}: scope ${m[1]} is not documented in .env.example`);
      }
    }
  }
  return problems;
}

function gitTracked(root) {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

runCli(import.meta.url, (root) => checkSecrets(root), 'secrets');
