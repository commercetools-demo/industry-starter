// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Version gate (bootstrap spec: Scaffold with the pinned stack).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RULES = [
  { name: 'next', min: [16, 0, 1], label: 'next > 16.0.0' },
  { name: 'next-intl', major: 4, label: 'next-intl 4.x' },
  { name: '@commercetools/platform-sdk', major: 8, label: '@commercetools/platform-sdk 8.x' },
  { name: '@commercetools/ts-client', major: 4, label: '@commercetools/ts-client 4.x' },
  { name: 'react', major: 19, label: 'react 19.x' },
];

export const parseVersion = (v) => {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const atLeast = (a, b) => (a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2]);

/** Uses the installed version when node_modules has it, else the declared range. Returns problems (empty = pass). */
export function checkVersions(root) {
  const problems = [];
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const rule of RULES) {
    const installed = path.join(root, 'node_modules', ...rule.name.split('/'), 'package.json');
    const raw = existsSync(installed) ? JSON.parse(readFileSync(installed, 'utf8')).version : declared[rule.name];
    const v = raw && parseVersion(raw);
    if (!v) { problems.push(`${rule.name}: not installed (need ${rule.label})`); continue; }
    if (rule.min && !atLeast(v, rule.min)) problems.push(`${rule.name} ${v.join('.')} is below the required ${rule.label}`);
    if (rule.major && v[0] !== rule.major) problems.push(`${rule.name} ${v.join('.')} must stay on major ${rule.major} (${rule.label})`);
  }
  const nvmrc = path.join(root, '.nvmrc');
  if (!existsSync(nvmrc)) problems.push('.nvmrc is missing (must contain 22)');
  else if (!readFileSync(nvmrc, 'utf8').trim().startsWith('22')) problems.push('.nvmrc must start with 22');
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkVersions(process.cwd());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('versions: OK');
}
