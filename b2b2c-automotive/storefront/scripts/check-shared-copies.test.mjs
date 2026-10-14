// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSharedCopies, SHARED_COPIES } from './check-shared-copies.mjs';
import { tmpApp } from './test-utils.mjs';

const file = 'lib/contracts/return-item.ts';
const roots = (store, portal) => {
  const a = tmpApp(store === undefined ? {} : { [file]: store });
  const b = tmpApp(portal === undefined ? {} : { [file]: portal });
  return [a, b];
};

describe('shared contract copies equal', () => {
  it('identical copies pass', () => {
    const [a, b] = roots('export const X = 1;\n', 'export const X = 1;\n');
    expect(checkSharedCopies(a, b, [file]).problems).toEqual([]);
  });
  it('a differing byte fails and names the file', () => {
    const [a, b] = roots('export const X = 1;\n', 'export const X = 2;\n');
    const { problems } = checkSharedCopies(a, b, [file]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(file);
  });
  it('a missing storefront copy fails', () => {
    const [a, b] = roots(undefined, 'export const X = 1;\n');
    expect(checkSharedCopies(a, b, [file]).problems[0]).toContain('missing in the storefront');
  });
  it('without a portal directory the compare is skipped with a notice', () => {
    const [a] = roots('x', 'x');
    const result = checkSharedCopies(a, path.join(a, 'no-portal'), [file]);
    expect(result.problems).toEqual([]);
    expect(result.notices).toHaveLength(1);
  });
  it('the real copies are listed and identical', () => {
    expect(SHARED_COPIES).toContain(file);
    expect(checkSharedCopies().problems).toEqual([]);
  });
});
