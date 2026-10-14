/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkBuildEnv, REQUIRED } from './check-build-env.mjs';

describe('release build environment (Q-X11, portal)', () => {
  it('lists what next.config.ts bakes into the headers at build time', () => {
    expect(REQUIRED.map((r) => r.name)).toEqual(['STOREFRONT_ORIGIN']);
  });
  it('a release build without STOREFRONT_ORIGIN fails and names it', () => {
    const r = checkBuildEnv({ RELEASE: '1' });
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/STOREFRONT_ORIGIN/);
  });
  it('a production Netlify context counts as a release', () => {
    expect(checkBuildEnv({ NODE_ENV: 'production', CONTEXT: 'production' }).problems).toHaveLength(1);
    expect(checkBuildEnv({ NODE_ENV: 'production', CONTEXT: 'deploy-preview' }).problems).toEqual([]);
  });
  it('a release build with a bare http(s) origin passes; a path, credentials or a plain word fail', () => {
    expect(checkBuildEnv({ RELEASE: '1', STOREFRONT_ORIGIN: 'https://shop.example.com' }).problems).toEqual([]);
    expect(checkBuildEnv({ RELEASE: '1', STOREFRONT_ORIGIN: 'https://shop.example.com/de' }).problems).toHaveLength(1);
    expect(checkBuildEnv({ RELEASE: '1', STOREFRONT_ORIGIN: 'shop' }).problems).toHaveLength(1);
    expect(checkBuildEnv({ RELEASE: '1', STOREFRONT_ORIGIN: 'http://localhost:3000' }).problems).toHaveLength(1); // localhost in a release
  });
  it('a build that is not a release is not checked (development and the dummy-env verify:build)', () => {
    expect(checkBuildEnv({})).toEqual({ problems: [], notices: [] });
    expect(checkBuildEnv({ NODE_ENV: 'production' }).problems).toEqual([]);
  });
});
