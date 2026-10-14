// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// A release build contains no health route. Release = RELEASE=1, or NODE_ENV=production together with CONTEXT=production.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const isRelease = (env) => env.RELEASE === '1' || (env.NODE_ENV === 'production' && env.CONTEXT === 'production');

export function checkNoHealthInRelease(root, env = process.env) {
  if (!isRelease(env)) return [];
  return existsSync(path.join(root, 'app', 'api', 'health', 'route.ts')) ? ['app/api/health/route.ts must not exist in a release build'] : [];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkNoHealthInRelease(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('no-health-in-release: OK');
}
