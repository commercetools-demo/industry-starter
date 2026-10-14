// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
// Workstream X-12: the JWT canary is ignored by a production run unless ATTACK_MODE=1.
import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/ct/admin-client', () => ({
  adminRoot: { customObjects: () => ({ withContainerAndKey: () => ({ get: () => ({ execute: () => get() }) }), post: () => ({ execute: vi.fn() }) }) },
}));

import { canaryToken, resolveContentoolsJwt } from './jwt';

const CANARY = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQU5BUlktUFJPSkVDVCJ9.CANARY-SIGNATURE-0123456789';
afterEach(() => {
  vi.unstubAllEnvs();
  get.mockReset();
});

describe('jwt canary ignored in production', () => {
  it('is honoured in development and test', () => {
    expect(canaryToken({ NODE_ENV: 'development', CONTENTOOLS_JWT_CANARY: CANARY })).toBe(CANARY);
    expect(canaryToken({ NODE_ENV: 'test', CONTENTOOLS_JWT_CANARY: CANARY })).toBe(CANARY);
  });
  it('is ignored by a production run without ATTACK_MODE, and honoured with ATTACK_MODE=1', () => {
    expect(canaryToken({ NODE_ENV: 'production', CONTENTOOLS_JWT_CANARY: CANARY })).toBeNull();
    expect(canaryToken({ NODE_ENV: 'production', CONTENTOOLS_JWT_CANARY: CANARY, ATTACK_MODE: 'true' })).toBeNull();
    expect(canaryToken({ NODE_ENV: 'production', CONTENTOOLS_JWT_CANARY: CANARY, ATTACK_MODE: '1' })).toBe(CANARY);
  });
  it('an unset or blank canary is no canary', () => {
    expect(canaryToken({ NODE_ENV: 'development' })).toBeNull();
    expect(canaryToken({ NODE_ENV: 'development', CONTENTOOLS_JWT_CANARY: '  ' })).toBeNull();
  });
  it('the proxy token is the canary in an attack run, and the stored object is not even read', async () => {
    vi.stubEnv('CONTENTOOLS_JWT_CANARY', CANARY);
    expect(await resolveContentoolsJwt()).toBe(CANARY);
    expect(get).not.toHaveBeenCalled();
  });
  it('without a canary a missing stored token still means not connected', async () => {
    vi.stubEnv('CONTENTOOLS_JWT_CANARY', '');
    get.mockRejectedValue({ statusCode: 404 });
    expect(await resolveContentoolsJwt()).toBeNull();
  });
});
