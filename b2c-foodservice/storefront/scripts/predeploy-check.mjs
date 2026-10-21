// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Deploy gate: the throwaway diagnostic routes must be gone before deploying.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @returns {string[]} problems; empty means pass */
export function checkPredeploy(root) {
  const problems = [];
  if (existsSync(join(root, 'app', 'api', 'health', 'route.ts'))) {
    problems.push('Remove app/api/health/route.ts before deploying');
  }
  if (existsSync(join(root, 'app', 'api', 'dev'))) {
    problems.push('Remove app/api/dev before deploying');
  }
  if (existsSync(join(root, 'app', '[locale]', 'dev'))) {
    problems.push('Remove app/[locale]/dev (the design kitchen sink) before deploying');
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const problems = checkPredeploy(root);
  if (problems.length > 0) {
    for (const p of problems) console.error(`predeploy: ${p}`);
    process.exit(1);
  }
  console.log('predeploy: ok');
}
