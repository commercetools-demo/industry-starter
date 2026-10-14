// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkNoHealthInRelease } from './check-no-health-in-release.mjs';
import { tmpApp } from './test-utils.mjs';

const WITH = { 'app/api/health/route.ts': 'export {};' };

describe('Gates and tests: Release without health route', () => {
  it('Release without health route: fails while the route exists', () => {
    expect(checkNoHealthInRelease(tmpApp(WITH), { RELEASE: '1' })).toHaveLength(1);
    expect(checkNoHealthInRelease(tmpApp(WITH), { NODE_ENV: 'production', CONTEXT: 'production' })).toHaveLength(1);
  });
  it('passes in a release build without the route', () => {
    expect(checkNoHealthInRelease(tmpApp({}), { RELEASE: '1' })).toEqual([]);
  });
  it('passes outside a release build even with the route', () => {
    expect(checkNoHealthInRelease(tmpApp(WITH), {})).toEqual([]);
    expect(checkNoHealthInRelease(tmpApp(WITH), { NODE_ENV: 'production', CONTEXT: 'deploy-preview' })).toEqual([]);
  });
});
