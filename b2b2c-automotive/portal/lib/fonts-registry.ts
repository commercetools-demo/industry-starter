/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** Pure data (no next/font import), safe in tests. The portal is not reseller-themed: Inter is the only family. */
export interface FontEntry {
  family: string;
  cssVar: string;
}

export const FONT_REGISTRY: readonly FontEntry[] = [{ family: 'Inter', cssVar: '--font-inter' }];
