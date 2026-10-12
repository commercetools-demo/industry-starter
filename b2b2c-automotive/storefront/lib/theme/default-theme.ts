// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The Malva automotive theme (Garage Maroon). default-theme.json is the single source of truth: the same file is what the
// `default` Contentools namespace holds, and the adapter emits nothing for it because tokens.css already carries it.
import defaultThemeJson from './default-theme.json';
import type { CompleteTheme } from './types';

export const MALVA_DEFAULT_THEME: CompleteTheme = defaultThemeJson as CompleteTheme;
