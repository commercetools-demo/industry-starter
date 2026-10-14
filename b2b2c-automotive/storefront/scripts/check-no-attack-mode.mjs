// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The attack harness switch (workstream X-12) must never reach a release. `ATTACK_MODE` (the one name of the switch) and
// `CONTENTOOLS_JWT_CANARY` may not appear in any release configuration file (netlify.toml, vercel.json, .env.production,
// next.config.*, CI workflow files), may not carry a value in .env.example, and may not be truthy in the environment of a
// production run. The same script lives in storefront/ and portal/.
// Usage: node scripts/check-no-attack-mode.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ATTACK_NAMES = ['ATTACK_MODE', 'CONTENTOOLS_JWT_CANARY'];
const FALSY = new Set(['', '0', 'false', 'off', 'no', undefined]);

const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
const mentions = (text) => ATTACK_NAMES.filter((n) => text.includes(n));

/** `NAME=value` lines of an env example whose value is not empty. */
function filledEnvLines(text) {
  const problems = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(ATTACK_MODE|CONTENTOOLS_JWT_CANARY)\s*=\s*(.*?)\s*$/);
    if (m && m[2].replace(/^["']|["']$/g, '') !== '') problems.push(m[1]);
  }
  return problems;
}

export function checkNoAttackMode(root, env = process.env) {
  const problems = [];
  const dirs = [root, path.resolve(root, '..')];
  const files = [];
  for (const dir of dirs) {
    files.push(path.join(dir, 'netlify.toml'), path.join(dir, 'vercel.json'), path.join(dir, '.env.production'), path.join(dir, '.env.production.local'));
    for (const ext of ['ts', 'mjs', 'js', 'cjs']) files.push(path.join(dir, `next.config.${ext}`));
    const workflows = path.join(dir, '.github', 'workflows');
    if (existsSync(workflows)) for (const f of readdirSync(workflows)) files.push(path.join(workflows, f));
  }
  for (const file of files) {
    const text = read(file);
    if (text === null) continue;
    for (const name of mentions(text)) problems.push(`${path.relative(root, file) || file} mentions ${name}: the attack switch must not be part of a release configuration`);
  }
  const example = read(path.join(root, '.env.example'));
  if (example !== null) for (const name of filledEnvLines(example)) problems.push(`.env.example gives ${name} a value (it must be absent or empty)`);

  if (env.NODE_ENV === 'production') {
    for (const name of ATTACK_NAMES) {
      if (!FALSY.has(env[name]?.toString().trim().toLowerCase())) problems.push(`${name} is set in a production environment`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const problems = checkNoAttackMode(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('no-attack-mode: OK');
}
