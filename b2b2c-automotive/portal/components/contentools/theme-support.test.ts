// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { isPresetSupported, PRESET_TABLE, UNSUPPORTED_PRESET_KEYS } from './theme-support';

describe('theme preset support', () => {
  it('neumorphism and glassmorphism unsupported; flat, material, brutalism, dark-moody supported', () => {
    expect(UNSUPPORTED_PRESET_KEYS).toEqual(expect.arrayContaining(['neumorphism', 'glassmorphism']));
    for (const key of ['flat', 'material', 'brutalism', 'dark-moody']) expect(UNSUPPORTED_PRESET_KEYS).not.toContain(key);
  });

  it('every themePresets entry is classified by the rule', () => {
    const keys = Object.keys(PRESET_TABLE);
    expect(keys.length).toBeGreaterThanOrEqual(9);
    for (const key of keys) {
      const tokens = PRESET_TABLE[key];
      const byRule = !['neumorphic', 'clay'].includes(tokens.shadowStyle ?? '') && (tokens.surfaceBlur ?? 'none') === 'none' && !['gradient', 'noise'].includes(tokens.backgroundStyle ?? '');
      expect(isPresetSupported(tokens)).toBe(byRule);
      expect(UNSUPPORTED_PRESET_KEYS.includes(key)).toBe(!byRule);
    }
  });
});
