// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const PUCK_VALUE_IMPORT = /^\s*import\s+(?!type\b)[^;]*?from\s+['"]@commercetools-demo\/puck-[\w-]+['"]/m;
const USE_CLIENT = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/;

describe('createContext footgun: server boundary', () => {
  it('Server files import only types from Puck packages', () => {
    const serverFiles = [
      ...walk(path.join(root, 'lib/contentools')).filter((f) => /\.ts$/.test(f) && !/\.test\./.test(f)),
      ...walk(path.join(root, 'app')).filter((f) => /(page|layout|route)\.tsx?$/.test(f) && !/\.test\./.test(f)),
    ].filter((f) => !USE_CLIENT.test(readFileSync(f, 'utf8')));
    expect(serverFiles.length).toBeGreaterThan(4);
    const offenders = serverFiles.filter((f) => PUCK_VALUE_IMPORT.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });
  it('The renderer wiring is a client file', () => {
    expect(USE_CLIENT.test(readFileSync(path.join(root, 'components/contentools/ContentoolsPage.tsx'), 'utf8'))).toBe(true);
  });
  it('The detector catches a value import and ignores a type import', () => {
    expect(PUCK_VALUE_IMPORT.test("import { PuckDataRenderer } from '@commercetools-demo/puck-renderer';")).toBe(true);
    expect(PUCK_VALUE_IMPORT.test("import type { PuckData } from '@commercetools-demo/puck-types';")).toBe(false);
  });
});
