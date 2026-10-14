/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules', '.next', '.git', 'coverage']);

/** All files below `dir` (empty when it does not exist), skipping build and dependency folders. */
export const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        if (SKIP.has(f)) return [];
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

export const isTest = (f) => /\.(test|spec)\.[cm]?[tj]sx?$/.test(f);

/** Runs `fn(cwd)` when the file is the entry point and exits 1 with the problems printed. */
export function runCli(metaUrl, fn, okLabel) {
  if (process.argv[1] && metaUrl === new URL(`file://${path.resolve(process.argv[1])}`).href) {
    const problems = fn(process.cwd());
    if (problems.length) {
      console.error(problems.join('\n'));
      process.exit(1);
    }
    console.log(`${okLabel}: OK`);
  }
}
