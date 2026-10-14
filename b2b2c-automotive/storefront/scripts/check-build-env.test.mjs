// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkBuildEnv, REQUIRED } from './check-build-env.mjs';

const ok = { PORTAL_ORIGIN: 'https://portal.example.com', CSP_IMG_HOSTS: 'https://images.example.com, https://cdn.example.com' };

describe('release build environment (Q-X11, storefront)', () => {
  it('lists what next.config.ts bakes into the headers at build time', () => {
    expect(REQUIRED.map((r) => r.name)).toEqual(['PORTAL_ORIGIN', 'CSP_IMG_HOSTS']);
  });
  it('a release build without them fails and names each one', () => {
    const { problems } = checkBuildEnv({ RELEASE: '1' });
    expect(problems).toHaveLength(2);
    expect(problems.join('\n')).toMatch(/PORTAL_ORIGIN/);
    expect(problems.join('\n')).toMatch(/CSP_IMG_HOSTS/);
  });
  it('production Netlify and Vercel contexts count as a release', () => {
    expect(checkBuildEnv({ NODE_ENV: 'production', CONTEXT: 'production' }).problems).toHaveLength(2);
    expect(checkBuildEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production' }).problems).toHaveLength(2);
    expect(checkBuildEnv({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }).problems).toEqual([]);
  });
  it('a release build with bare https origins passes', () => {
    expect(checkBuildEnv({ RELEASE: '1', ...ok }).problems).toEqual([]);
  });
  it('every image host is checked: http, a path, localhost and a blank entry list fail', () => {
    expect(checkBuildEnv({ RELEASE: '1', ...ok, CSP_IMG_HOSTS: 'https://a.example.com, http://b.example.com' }).problems).toHaveLength(1);
    expect(checkBuildEnv({ RELEASE: '1', ...ok, CSP_IMG_HOSTS: 'https://a.example.com/path' }).problems).toHaveLength(1);
    expect(checkBuildEnv({ RELEASE: '1', ...ok, PORTAL_ORIGIN: 'http://localhost:3001' }).problems).toHaveLength(1);
    expect(checkBuildEnv({ RELEASE: '1', ...ok, CSP_IMG_HOSTS: ' , ' }).problems).toHaveLength(1);
  });
  it('a build that is not a release is not checked', () => {
    expect(checkBuildEnv({})).toEqual({ problems: [], notices: [] });
    expect(checkBuildEnv({ NODE_ENV: 'production' }).problems).toEqual([]);
  });
});
