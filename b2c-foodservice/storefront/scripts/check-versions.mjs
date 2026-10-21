// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Version gate (bootstrap-and-structure: Stack and version gates).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC = 'bootstrap-and-structure: Stack and version gates';

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function installed(root, name) {
  const pkg = readJson(join(root, 'node_modules', name, 'package.json'));
  return pkg && typeof pkg.version === 'string' ? pkg.version : null;
}

function parse(version) {
  const [major, minor = 0, patch = 0] = version.split(/[-+]/)[0].split('.').map(Number);
  return { major, minor, patch };
}

function greaterThan(version, floor) {
  const a = parse(version);
  const b = parse(floor);
  return (a.major - b.major || a.minor - b.minor || a.patch - b.patch) > 0;
}

/** @returns {string[]} problems; empty means pass */
export function checkVersions(root) {
  const problems = [];
  const pkgJson = readJson(join(root, 'package.json'));
  if (!pkgJson) return [`package.json not found in ${root} (${SPEC})`];

  const majorRules = [
    ['next', 16],
    ['next-intl', 4],
    ['@commercetools/platform-sdk', 8],
    ['@commercetools/ts-client', 4],
    ['react', 19],
    ['tailwindcss', 4],
  ];
  for (const [name, major] of majorRules) {
    const version = installed(root, name);
    if (!version) {
      problems.push(`${name} is not installed, the rule is ${name} major ${major} (${SPEC})`);
    } else if (parse(version).major !== major) {
      problems.push(`${name} ${version} installed, the rule is ${name} major ${major} (${SPEC})`);
    }
  }
  const next = installed(root, 'next');
  if (next && parse(next).major === 16 && !greaterThan(next, '16.0.0')) {
    problems.push(`next ${next} installed, the rule is next >16.0.0 (${SPEC})`);
  }

  const nextRange = pkgJson.dependencies?.next ?? pkgJson.devDependencies?.next ?? '';
  if (/^[\^~>=\s]*15/.test(nextRange)) {
    problems.push(`package.json next range "${nextRange}" starts with 15, the rule is next 16.x (${SPEC})`);
  }

  const tailwindConfigs = existsSync(root)
    ? readdirSync(root).filter((f) => /^tailwind\.config\./.test(f))
    : [];
  if (tailwindConfigs.length > 0) {
    problems.push(`${tailwindConfigs[0]} exists, the rule is Tailwind v4 with no config file (${SPEC})`);
  }

  const nvmrcPath = join(root, '.nvmrc');
  if (!existsSync(nvmrcPath)) {
    problems.push(`.nvmrc is missing, the rule is a file starting with 22 (${SPEC})`);
  } else if (!readFileSync(nvmrcPath, 'utf8').trim().startsWith('22')) {
    problems.push(`.nvmrc does not start with 22, the rule is Node 22 (${SPEC})`);
  }

  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const problems = checkVersions(root);
  if (problems.length > 0) {
    for (const p of problems) console.error(`version gate: ${p}`);
    process.exit(1);
  }
  console.log('version gate: ok');
}
