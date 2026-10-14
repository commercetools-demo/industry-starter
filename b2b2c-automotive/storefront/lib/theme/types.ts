// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The installed @commercetools-demo/puck-types (0.8.1) exports ThemeTokens, so the type is re-exported, not copied.
import type { ThemeTokens } from '@commercetools-demo/puck-types';

export type { ThemeTokens };
export type ThemeVars = Record<string, string>;

/** Colour fields the default theme always carries (several are optional in ThemeTokens). */
export type ColourKey =
  | 'colorPrimary'
  | 'colorPrimaryForeground'
  | 'colorSecondary'
  | 'colorSecondaryForeground'
  | 'colorBackground'
  | 'colorSurface'
  | 'colorText'
  | 'colorTextMuted'
  | 'colorAccent'
  | 'colorBorder';

/** A ThemeTokens with the optional fields the adapter reads made required: what parseTheme returns. */
export type CompleteTheme = ThemeTokens & Required<Pick<ThemeTokens, ColourKey | 'shadowStyle'>>;
