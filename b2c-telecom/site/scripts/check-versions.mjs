import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Required ranges: [name, inclusive minimum, exclusive maximum].
const REQUIRED = [
  ['next', '16.0.0', '17.0.0'],
  ['next-intl', '4.0.0', '5.0.0'],
  ['@commercetools/platform-sdk', '8.0.0', '9.0.0'],
  ['@commercetools/ts-client', '4.0.0', '5.0.0'],
  ['tailwindcss', '4.0.0', '5.0.0'],
];

/** Parses "1.2.3-beta.1" into [1, 2, 3]; the pre-release suffix is ignored. */
function parse(version) {
  return version
    .split(/[-+]/)[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compare(a, b) {
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function resolveVersion(dir, name, lock) {
  const fromLock = lock?.packages?.[`node_modules/${name}`]?.version;
  if (typeof fromLock === 'string') return fromLock;
  const installed = readJson(path.join(dir, 'node_modules', name, 'package.json'));
  return typeof installed?.version === 'string' ? installed.version : undefined;
}

/**
 * Returns the list of version problems (empty = pass).
 * @param {string} dir the site directory
 * @returns {string[]}
 */
export function checkVersions(dir) {
  const problems = [];
  const lock = readJson(path.join(dir, 'package-lock.json'));
  for (const [name, min, max] of REQUIRED) {
    const resolved = resolveVersion(dir, name, lock);
    if (resolved === undefined) {
      problems.push(`${name}: not installed`);
    } else if (compare(resolved, min) < 0 || compare(resolved, max) >= 0) {
      problems.push(`${name}: resolved ${resolved}, required >=${min} <${max}`);
    }
  }
  for (const file of readdirSync(dir)) {
    if (file.startsWith('tailwind.config.')) {
      problems.push(`${file} must not exist; Tailwind v4 is configured in CSS`);
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkVersions(process.cwd());
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
