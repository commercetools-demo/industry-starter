/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Dev pages are never part of a build: a route under `app/**/dev/**` must use the `.dev.tsx` / `.dev.ts` extension,
// which next.config.ts registers as a page extension outside production builds only (see Q-B02).
import path from 'node:path';
import { runCli, walk } from './fs-utils.mjs';

export function checkNoDevPages(root) {
  const app = path.join(root, 'app');
  return walk(app)
    .map((f) => path.relative(app, f).split(path.sep).join('/'))
    .filter((rel) => /(^|\/)dev\/(.*\/)?(page|route|layout)\.(tsx?|jsx?)$/.test(rel))
    .map((rel) => `app/${rel}: a dev route must be named page.dev.tsx so production builds exclude it`);
}

runCli(import.meta.url, checkNoDevPages, 'dev pages');
