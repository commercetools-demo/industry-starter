// Version gate (malva-project-bootstrap › Supported framework and dependency versions).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RULES = [
  { name: 'next', min: [16, 0, 0], label: 'next >= 16.0.0' },
  { name: 'next-intl', min: [4, 0, 0], label: 'next-intl >= 4' },
  { name: '@commercetools/platform-sdk', major: 8, label: '@commercetools/platform-sdk ^8' },
  { name: '@commercetools/ts-client', major: 4, label: '@commercetools/ts-client ^4' },
];

export const parseVersion = (v) => {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const atLeast = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2];

/** Installed version when node_modules exists, else the declared range. Returns an array of problems. */
export function checkVersions(root) {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const problems = [];
  for (const rule of RULES) {
    const installedFile = path.join(root, 'node_modules', ...rule.name.split('/'), 'package.json');
    const raw = existsSync(installedFile) ? JSON.parse(readFileSync(installedFile, 'utf8')).version : declared[rule.name];
    const v = raw && parseVersion(raw);
    if (!v) { problems.push(`${rule.name}: not installed (need ${rule.label})`); continue; }
    if (rule.min && !atLeast(v, rule.min)) problems.push(`${rule.name} ${v.join('.')} is below the required ${rule.label}`);
    if (rule.major && v[0] !== rule.major) problems.push(`${rule.name} ${v.join('.')} must stay on major ${rule.major} (skill-pinned, see design decision 3)`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkVersions(process.cwd());
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('versions: OK');
}
