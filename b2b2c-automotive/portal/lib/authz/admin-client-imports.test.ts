/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const ALLOWED = [/^app\/api\/seller\//, /^lib\/ct\/seller\//, /^lib\/contentools\/jwt\.ts$/, /^lib\/ct\/admin-client\.ts$/];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('admin client fence', () => {
  it('admin client only imported from allowed folders', () => {
    const offenders = ['app', 'lib', 'components', 'hooks', 'context']
      .flatMap((d) => walk(path.join(root, d)))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => path.relative(root, f).split(path.sep).join('/'))
      .filter((rel) => /from\s+['"][^'"]*admin-client['"]/.test(readFileSync(path.join(root, rel), 'utf8')))
      .filter((rel) => !ALLOWED.some((re) => re.test(rel)));
    expect(offenders).toEqual([]);
  });

  it('no project-level cart call outside the admin modules', () => {
    const offenders = ['app', 'lib']
      .flatMap((d) => walk(path.join(root, d)))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => path.relative(root, f).split(path.sep).join('/'))
      .filter((rel) => /apiRoot\s*\.carts\(/.test(readFileSync(path.join(root, rel), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')))
      .filter((rel) => !/^lib\/ct\/(admin|seller)/.test(rel));
    expect(offenders).toEqual([]);
  });
});
