// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Dev pages (app/**/dev/**) must not exist in a release build, and elsewhere must answer notFound() in production.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRelease } from './check-no-health-in-release.mjs';

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

const GUARD = /process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*\)\s*(\{\s*)?(notFound\(\)|return\s+(new\s+Response|null))/;

export function checkNoDevPages(root, env = process.env) {
  const appDir = path.join(root, 'app');
  const pages = walk(appDir).filter(
    (f) => /(^|[\\/])dev[\\/].*(page|route)\.(tsx?|jsx?)$/.test(path.relative(appDir, f)) && !/\.test\./.test(f),
  );
  if (isRelease(env)) return pages.map((f) => `${path.relative(root, f)}: dev pages must not exist in a release build`);
  return pages
    .filter((f) => !GUARD.test(readFileSync(f, 'utf8')))
    .map((f) => `${path.relative(root, f)}: a dev page must call notFound() when NODE_ENV is production`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkNoDevPages(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('dev pages: OK');
}
