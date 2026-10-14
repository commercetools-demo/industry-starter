/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { checkNoHealthInRelease } from './check-no-health-in-release.mjs';
import { tmp } from './test-utils.mjs';

const withHealth = () => tmp({ 'app/api/health/route.ts': 'export {};' });

describe('Release without health route', () => {
  it('Release without health route fails when RELEASE=1', () => {
    expect(checkNoHealthInRelease(withHealth(), { RELEASE: '1' }).join('')).toMatch(/must not exist in a release build/);
  });
  it('fails in the production context', () => {
    expect(checkNoHealthInRelease(withHealth(), { NODE_ENV: 'production', CONTEXT: 'production' })).toHaveLength(1);
  });
  it('passes in development and in a deploy preview', () => {
    expect(checkNoHealthInRelease(withHealth(), {})).toEqual([]);
    expect(checkNoHealthInRelease(withHealth(), { NODE_ENV: 'production', CONTEXT: 'deploy-preview' })).toEqual([]);
  });
  it('passes in a release when the route is gone', () => {
    expect(checkNoHealthInRelease(tmp({}), { RELEASE: '1' })).toEqual([]);
  });
});
