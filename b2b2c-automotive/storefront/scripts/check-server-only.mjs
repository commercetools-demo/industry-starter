// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Server-only boundary: guarded modules start with `import 'server-only'`; client-side code never imports them.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];
const isTest = (f) => /\.(test|spec)\.[cm]?[tj]sx?$/.test(f);
const isCode = (f) => /\.[cm]?[tj]sx?$/.test(f) && !isTest(f);

const GUARD = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*import\s+['"]server-only['"];?/;
const SERVER_IMPORT = /from\s+['"]@\/lib\/(ct(\/[^'"]*)?|session[^'"]*|contentools\/(puck|theme)[^'"]*)['"]/;
const USE_CLIENT = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/;

export function checkServerOnly(root) {
  const problems = [];
  const lib = path.join(root, 'lib');
  const guarded = [
    ...walk(path.join(lib, 'ct')),
    ...(existsSync(lib) ? readdirSync(lib).filter((f) => /^session.*\.ts$/.test(f)).map((f) => path.join(lib, f)) : []),
    // origin.ts is imported by client code (CONTENTOOLS_PROXY_BASE) and is exempt.
    ...walk(path.join(lib, 'contentools')).filter((f) => path.basename(f) !== 'origin.ts'),
  ].filter(isCode);
  for (const f of guarded) {
    if (!GUARD.test(readFileSync(f, 'utf8'))) problems.push(`${path.relative(root, f)} must start with import 'server-only'`);
  }
  const clientCandidates = [
    ...walk(path.join(root, 'app')),
    ...walk(path.join(root, 'components')),
    ...walk(path.join(root, 'hooks')),
    ...walk(path.join(root, 'context')),
  ].filter(isCode);
  for (const f of clientCandidates) {
    const rel = path.relative(root, f);
    const text = readFileSync(f, 'utf8');
    const inClientDir = /^(components|hooks|context)[\\/]/.test(rel);
    if ((inClientDir || USE_CLIENT.test(text)) && SERVER_IMPORT.test(text)) {
      problems.push(`${rel}: client-side code must not import server-only modules (lib/ct, lib/session, lib/contentools/puck|theme)`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkServerOnly(process.cwd());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('server-only: OK');
}
