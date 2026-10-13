// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { DEFAULT_TOKEN_LENGTH, decoyToken, isOnScreenResetEnabled, isPlausibleToken, rememberTokenShape, resetPath, tokenShape } from './demo-reset';

describe('on-screen reset flag', () => {
  it('is on by default outside production and off in production', () => {
    expect(isOnScreenResetEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isOnScreenResetEnabled({ NODE_ENV: 'production' })).toBe(false);
  });
  it('an explicit value wins', () => {
    expect(isOnScreenResetEnabled({ NODE_ENV: 'production', DEMO_ONSCREEN_RESET: 'true' })).toBe(true);
    expect(isOnScreenResetEnabled({ NODE_ENV: 'development', DEMO_ONSCREEN_RESET: 'false' })).toBe(false);
  });
});

describe('decoy token', () => {
  it('decoy has the length and alphabet of a real token', () => {
    const real = 'AbC-123_xyzAbC-123_xyzAbC-123_xyzAbC-123_xyz';
    const shape = tokenShape(real);
    const decoy = decoyToken(shape);
    expect(decoy).toHaveLength(real.length);
    expect(decoy).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(decoyToken(shape)).not.toBe(decoy);
  });
  it('a token of letters and digits only gets a decoy of letters and digits only', () => {
    expect(decoyToken(tokenShape('abcdefghijklmnopqrstuvwx0123'))).toMatch(/^[A-Za-z0-9]{28}$/);
  });
  it('copies the shape of the last real token, default length before any', () => {
    rememberTokenShape('Q'.repeat(30));
    expect(decoyToken()).toHaveLength(30);
    expect(DEFAULT_TOKEN_LENGTH).toBe(43);
  });
  it('plausibility and path', () => {
    expect(isPlausibleToken('short')).toBe(false);
    expect(isPlausibleToken('a'.repeat(32))).toBe(true);
    expect(isPlausibleToken(`${'a'.repeat(20)}"<script>`)).toBe(false);
    expect(resetPath('en-US', 'mau-reseller-north', 'tok-1')).toBe('/en-US/mau-reseller-north/account/reset-password?token=tok-1');
  });
});
