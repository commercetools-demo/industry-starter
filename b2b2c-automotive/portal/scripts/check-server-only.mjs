// Server-only boundary (bootstrap-and-structure > Directory structure, Server-only boundary).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isTest, runCli, walk } from './fs-utils.mjs';

const GUARD = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*import\s+['"]server-only['"];?/;
const FORBIDDEN_IN_CLIENT = /from\s+['"]@\/lib\/(ct(\/|['"])|session|contentools\/(puck|theme))/;
const IMPORT_SIDE_EFFECT = /import\s+['"]@\/lib\/(ct(\/|['"])|session|contentools\/(puck|theme))/;
const isCode = (f) => /\.[tj]sx?$/.test(f) && !isTest(f);

export function checkServerOnly(root) {
  const problems = [];
  const lib = path.join(root, 'lib');
  const guarded = [
    ...walk(path.join(lib, 'ct')),
    ...(existsSync(lib) ? readdirSync(lib).filter((f) => /^session.*\.ts$/.test(f)).map((f) => path.join(lib, f)) : []),
    ...walk(path.join(lib, 'contentools')).filter((f) => path.basename(f) !== 'origin.ts'),
  ].filter(isCode);
  for (const f of guarded) {
    if (!GUARD.test(readFileSync(f, 'utf8'))) problems.push(`${path.relative(root, f)} must start with import 'server-only'`);
  }

  const clientFiles = [
    ...walk(path.join(root, 'app')),
    ...walk(path.join(root, 'components')),
    ...walk(path.join(root, 'hooks')),
    ...walk(path.join(root, 'context')),
  ].filter(isCode);
  for (const f of clientFiles) {
    const text = readFileSync(f, 'utf8');
    const rel = path.relative(root, f);
    const isClient = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(text) || /^(components|hooks|context)\//.test(rel);
    if (isClient && (FORBIDDEN_IN_CLIENT.test(text) || IMPORT_SIDE_EFFECT.test(text))) {
      problems.push(`${rel} is client code and must not import server-only modules (lib/ct, lib/session, lib/contentools/puck|theme); types live in lib/types.ts`);
    }
  }
  return problems;
}

runCli(import.meta.url, checkServerOnly, 'server-only');
