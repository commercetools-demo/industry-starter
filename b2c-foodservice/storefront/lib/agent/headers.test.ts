// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = __dirname;
const PORTED_DIRS = ['common', 'shopping', 'runtime'];
// Written for this deployment, not ported from upstream: they carry no Anthropic header (workstream T2, U-01).
const OWN_FILES = new Set(['shopping/ids.ts', 'shopping/money.ts', 'shopping/backend-contract.ts']);

function sources(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
  });
}

describe('Apache-2.0 headers on ported files', () => {
  const files = PORTED_DIRS.flatMap((d) => sources(join(ROOT, d))).filter((f) => !OWN_FILES.has(f.slice(ROOT.length + 1)));

  it('There are ported files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(ROOT.length + 1), f]))('%s carries the copyright, SPDX and "Adapted from" lines', (_name, file) => {
    const head = readFileSync(file, 'utf8').split('\n').slice(0, 3);
    expect(head[0]).toBe('// Copyright 2026 Anthropic PBC');
    expect(head[1]).toBe('// SPDX-License-Identifier: Apache-2.0');
    expect(head[2]).toMatch(/^\/\/ Adapted from \S+.*; changes: .+/);
  });
});
