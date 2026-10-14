// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkBuildOutput, checkRoutes, parseRoutes } from './check-routes.mjs';

const TABLE = 'Route (app)\n┌ ○ /\n├ ƒ /[locale]/[store]\n└ ○ /dev/tokens\n';

describe('Gates and tests: route table', () => {
  it('parses the build route table', () => {
    expect(parseRoutes(TABLE).map((r) => r.route)).toEqual(['/', '/[locale]/[store]', '/dev/tokens']);
  });
  it('a release build with a /dev route fails', () => {
    expect(checkRoutes(TABLE, { RELEASE: '1' })).toEqual(['route /dev/tokens must not be in a release build']);
  });
  it('X-13: build output with no route table (a failed `next build` piped through tee still exits 0) is a problem', () => {
    expect(checkBuildOutput('> Build error occurred\nError: boom\n', {})[0]).toMatch(/no route table/);
    expect(checkBuildOutput('', {})).toHaveLength(1);
    expect(checkBuildOutput(TABLE, {})).toEqual([]);
  });
  it('a non-release build may contain /dev', () => {
    expect(checkRoutes(TABLE, {})).toEqual([]);
  });
});
