/** Colour dot background for an enum key: the `--swatch-<key>` token, or `--swatch-fallback`. Same rule as `ColorSwatch`. */
export function swatchColour(key: string): string {
  const safe = /^[a-z0-9-]+$/.test(key) ? key : 'fallback';
  return `var(--swatch-${safe}, var(--swatch-fallback))`;
}

/** Cards show at most this many swatches, then "+n". */
export const MAX_SWATCHES = 4;
