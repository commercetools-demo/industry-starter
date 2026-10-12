'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Which ThemeManager presets the storefront honours (workstream U decision 5; storefront rule in
// consumer-storefront/theming-design "Locked tokens and unsupported theme fields"). The ThemeManager has no prop to filter its
// presets, so the editor boundary disables the unsupported options of its native `select#theme-preset-select`.
// Lives under components/ (not lib/contentools/) because it is client code that reads the package's preset table.
import { themePresets } from '@commercetools-demo/puck-theme-manager';
import type { ThemeTokens } from '@commercetools-demo/puck-types';

export const UNSUPPORTED_SUFFIX = ' (Not supported on your storefront)';

/**
 * True when the storefront can show the preset: no neumorphic or clay shadow, no surface blur, no gradient or noise background.
 * The storefront theme adapter only knows flat, soft, hard-offset and glow shadows, solid backgrounds and no blur.
 */
export function isPresetSupported(tokens: ThemeTokens): boolean {
  if (tokens.shadowStyle === 'neumorphic' || tokens.shadowStyle === 'clay') return false;
  if (tokens.surfaceBlur !== undefined && tokens.surfaceBlur !== 'none') return false;
  if (tokens.backgroundStyle === 'gradient' || tokens.backgroundStyle === 'noise') return false;
  return true;
}

/** Preset keys (the `value` of each select option) the storefront does not honour, derived from the package's table. */
export const UNSUPPORTED_PRESET_KEYS: readonly string[] = Object.entries(themePresets)
  .filter(([, tokens]) => !isPresetSupported(tokens))
  .map(([key]) => key);

/** Presets by key, for the tests. */
export const PRESET_TABLE: Readonly<Record<string, ThemeTokens>> = themePresets;
