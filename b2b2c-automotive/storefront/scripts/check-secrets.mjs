// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Secrets and environment files: no public prefix on secrets, nothing tracked, .env.example complete, every scope explained.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ENV_VARS, SECRET_VARS } from './app.config.mjs';

export { SECRET_VARS };
const SKIP = new Set(['node_modules', '.next', '.git', 'coverage']);
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    if (SKIP.has(f)) return [];
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const SCOPE_LINE = /^#\s+([a-z][a-z0-9_]*(?::[A-Za-z0-9_.-]+)?)\s+:\s*(.*)$/;

/** Scope documentation lines (`# <scope> : <reason>`) from an env file text. */
export function documentedScopes(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const m = SCOPE_LINE.exec(line.trim());
    if (m) map.set(m[1], m[2].trim());
  }
  return map;
}

/** Scopes listed as a value of a `*_SCOPES=` variable (space or comma separated). */
export function listedScopes(text) {
  const out = [];
  for (const m of text.matchAll(/^[A-Z_]*SCOPES=(.*)$/gm)) {
    out.push(...m[1].trim().replace(/^["']|["']$/g, '').split(/[\s,]+/).filter(Boolean));
  }
  return out;
}

/** `tracked` is injectable for tests; by default it is `git ls-files` (empty outside a repository). */
export function checkSecrets(root, tracked = gitTracked(root), envVars = ENV_VARS) {
  const problems = [];
  const pattern = new RegExp(`NEXT_PUBLIC_(${SECRET_VARS.join('|')}|[A-Z_]*(SECRET|PASSWORD|TOKEN))`);
  for (const f of walk(root)) {
    const base = path.basename(f);
    if (/\.(test|spec)\.[cm]?[tj]sx?$/.test(f) || base === 'check-secrets.mjs') continue;
    if (!/\.(m?[jt]sx?|json|md|example)$/.test(f) && !base.startsWith('.env')) continue;
    if (pattern.test(readFileSync(f, 'utf8'))) problems.push(`${path.relative(root, f)}: a secret must never carry the NEXT_PUBLIC_ prefix`);
  }
  for (const f of tracked) {
    if (/(^|\/)\.env($|\.(?!example$))/.test(f) || /(^|\/)\.next\//.test(f)) problems.push(`${f} is tracked by git`);
  }
  const examplePath = path.join(root, '.env.example');
  if (!existsSync(examplePath)) {
    problems.push('.env.example is missing');
    return problems;
  }
  const example = readFileSync(examplePath, 'utf8');
  for (const v of envVars) {
    if (!new RegExp(`^${v}=\\s*$`, 'm').test(example)) problems.push(`.env.example must list ${v}= with no value`);
  }
  const docs = documentedScopes(example);
  for (const [scope, reason] of docs) {
    if (!reason) problems.push(`scope ${scope} has an empty reason in .env.example`);
  }
  const local = path.join(root, '.env.local');
  const listed = [...listedScopes(example), ...(existsSync(local) ? listedScopes(readFileSync(local, 'utf8')) : [])];
  for (const scope of new Set(listed)) {
    if (!docs.has(scope)) problems.push(`scope ${scope} is used but has no "# ${scope} : <reason>" line in .env.example`);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkSecrets(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('secrets: OK');
}
