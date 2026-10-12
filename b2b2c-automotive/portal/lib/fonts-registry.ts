/** Pure data (no next/font import), safe in tests. The portal is not reseller-themed: Inter is the only family. */
export interface FontEntry {
  family: string;
  cssVar: string;
}

export const FONT_REGISTRY: readonly FontEntry[] = [{ family: 'Inter', cssVar: '--font-inter' }];
