// Version gate (bootstrap-and-structure > Scaffold with the pinned stack).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from './fs-utils.mjs';

const RULES = [
  { name: 'next', greaterThan: [16, 0, 0], label: 'next > 16.0.0' },
  { name: 'next-intl', major: 4, label: 'next-intl ^4' },
  { name: '@commercetools/platform-sdk', major: 8, label: '@commercetools/platform-sdk ^8' },
  { name: '@commercetools/ts-client', major: 4, label: '@commercetools/ts-client ^4' },
  { name: 'react', major: 19, label: 'react ^19' },
];

export const parseVersion = (v) => {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Installed version when node_modules exists, else the declared range. Returns the problems (empty = pass). */
export function checkVersions(root) {
  const problems = [];
  const nvmrc = path.join(root, '.nvmrc');
  if (!existsSync(nvmrc)) problems.push('.nvmrc is missing (must start with 22)');
  else if (!readFileSync(nvmrc, 'utf8').trim().startsWith('22')) problems.push('.nvmrc must start with 22');

  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const rule of RULES) {
    const installedFile = path.join(root, 'node_modules', ...rule.name.split('/'), 'package.json');
    const raw = existsSync(installedFile) ? JSON.parse(readFileSync(installedFile, 'utf8')).version : declared[rule.name];
    const v = raw && parseVersion(raw);
    if (!v) {
      problems.push(`${rule.name}: not installed (need ${rule.label})`);
      continue;
    }
    if (rule.greaterThan && cmp(v, rule.greaterThan) <= 0) problems.push(`${rule.name} ${v.join('.')} must be above ${rule.greaterThan.join('.')} (${rule.label})`);
    if (rule.major && v[0] !== rule.major) problems.push(`${rule.name} ${v.join('.')} must stay on major ${rule.major} (${rule.label})`);
  }
  return problems;
}

runCli(import.meta.url, checkVersions, 'versions');
