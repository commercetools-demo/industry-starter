// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure data (no next/font import) so tests and the theme font allow-list can read it.
export interface FontEntry {
  family: string;
  cssVar: string;
}

export const FONT_REGISTRY: readonly FontEntry[] = [
  { family: 'Poppins', cssVar: '--font-poppins' },
  { family: 'Archivo', cssVar: '--font-archivo' },
  { family: 'Public Sans', cssVar: '--font-public-sans' },
  { family: 'Inter', cssVar: '--font-inter' },
];
