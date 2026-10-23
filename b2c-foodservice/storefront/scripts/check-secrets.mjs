// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Static half of the secret rules (bootstrap-and-structure: Missing secret, Client bundle scan).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_NAMES = [
  'CTP_PROJECT_KEY',
  'EXPECTED_PROJECT_KEY',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_SCOPES',
  'SESSION_SECRET',
];

/** @returns {string[]} problems; empty means pass */
export function checkSecrets(root) {
  const problems = [];
  const examplePath = join(root, '.env.example');

  if (!existsSync(examplePath)) {
    problems.push('.env.example is missing');
  } else {
    const lines = readFileSync(examplePath, 'utf8').split('\n');
    const assignments = new Map();
    for (const line of lines) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
      if (m) assignments.set(m[1], m[2]);
    }
    for (const name of REQUIRED_NAMES) {
      if (!assignments.has(name)) problems.push(`.env.example does not list ${name}`);
    }
    for (const [name, value] of assignments) {
      if (value.trim() !== '') problems.push(`.env.example gives ${name} a value; names only`);
      if (name.startsWith('NEXT_PUBLIC_') && /SECRET|CLIENT_ID|SCOPES/.test(name)) {
        problems.push(`.env.example has ${name}; a secret must not be public`);
      }
    }
    // Every scope in the CTP_SCOPES comment block needs "# <scope> : <reason>".
    const start = lines.findIndex((l) => /^#.*Reasons:/.test(l));
    const end = lines.findIndex((l) => l.startsWith('CTP_SCOPES='));
    if (start === -1 || end === -1 || end < start) {
      problems.push('.env.example CTP_SCOPES needs a comment block "Reasons:" with one "# <scope> : <reason>" line per scope');
    } else {
      for (const line of lines.slice(start + 1, end)) {
        if (!/^# [a-z_]+ : \S.*$/.test(line)) {
          problems.push(`.env.example scope line is not "# <scope> : <reason>": ${line}`);
        }
      }
      if (end - start < 2) problems.push('.env.example lists no scopes with reasons');
    }
  }

  if (existsSync(root)) {
    const stray = readdirSync(root).filter(
      (f) => /^\.env(\..+)?$/.test(f) && f !== '.env.local' && f !== '.env.example',
    );
    for (const f of stray) {
      problems.push(`${f} must not exist; credentials come only from .env.local (Next.js would load it)`);
    }
  }

  try {
    const tracked = execFileSync('git', ['ls-files', '--', '.'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .filter(Boolean);
    for (const f of tracked) {
      const base = f.split('/').pop() ?? f;
      if (/^\.env/.test(base) && base !== '.env.example') problems.push(`${f} is tracked by version control`);
    }
  } catch {
    // Not a repository (for example a temp directory): nothing to check.
  }

  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const problems = checkSecrets(root);
  if (problems.length > 0) {
    for (const p of problems) console.error(`secret check: ${p}`);
    process.exit(1);
  }
  console.log('secret check: ok');
}
