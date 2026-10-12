// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkRoutes, parseRoutes } from './check-routes.mjs';

const TABLE = 'Route (app)\n┌ ○ /\n├ ƒ /[locale]/[store]\n└ ○ /dev/tokens\n';

describe('Gates and tests: route table', () => {
  it('parses the build route table', () => {
    expect(parseRoutes(TABLE).map((r) => r.route)).toEqual(['/', '/[locale]/[store]', '/dev/tokens']);
  });
  it('a release build with a /dev route fails', () => {
    expect(checkRoutes(TABLE, { RELEASE: '1' })).toEqual(['route /dev/tokens must not be in a release build']);
  });
  it('a non-release build may contain /dev', () => {
    expect(checkRoutes(TABLE, {})).toEqual([]);
  });
});
