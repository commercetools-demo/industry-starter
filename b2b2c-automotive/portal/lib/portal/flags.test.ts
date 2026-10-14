/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { isDemoLoginEnabled, isOnscreenResetEnabled, safeNextPath } from './flags';

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

describe('flags', () => {
  it('demo login needs the explicit flag and a non-production build', () => {
    expect(isDemoLoginEnabled(env({ NODE_ENV: 'development' }))).toBe(false);
    expect(isDemoLoginEnabled(env({ NODE_ENV: 'development', DEMO_LOGIN_ENABLED: 'true' }))).toBe(true);
    expect(isDemoLoginEnabled(env({ NODE_ENV: 'production', DEMO_LOGIN_ENABLED: 'true' }))).toBe(false);
    expect(isDemoLoginEnabled(env({ NODE_ENV: 'development', DEMO_LOGIN_ENABLED: 'yes' }))).toBe(false);
  });
  it('on-screen reset is on only when DEMO_ONSCREEN_RESET is true (the storefront spelling; Q-X10: "on" is no longer accepted)', () => {
    expect(isOnscreenResetEnabled(env({}))).toBe(false);
    expect(isOnscreenResetEnabled(env({ DEMO_ONSCREEN_RESET: 'false' }))).toBe(false);
    expect(isOnscreenResetEnabled(env({ DEMO_ONSCREEN_RESET: 'off' }))).toBe(false);
    expect(isOnscreenResetEnabled(env({ DEMO_ONSCREEN_RESET: 'on' }))).toBe(false);
    expect(isOnscreenResetEnabled(env({ DEMO_ONSCREEN_RESET: 'true' }))).toBe(true);
  });
  it('return path accepts only in-app paths', () => {
    expect(safeNextPath('/catalog?tab=assortment')).toBe('/catalog?tab=assortment');
    expect(safeNextPath('/')).toBe('/');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', 'javascript:alert(1)', '/javascript:x', '', null, undefined, 'catalog']) {
      expect(safeNextPath(bad as string | null | undefined), String(bad)).toBeNull();
    }
  });
});
