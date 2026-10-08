// WCAG 2.x contrast helpers (relative luminance and contrast ratio of two sRGB colors).

export type Rgb = readonly [number, number, number];

/** Parses `#rgb` or `#rrggbb` (case-insensitive) into 0-255 channels. */
export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex color: ${hex}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Relative luminance (0 black .. 1 white) per WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex colors, 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;

/**
 * WCAG AA for text. Large text is at least 24px regular or 18.66px bold; pass `large: true` for it.
 */
export function meetsAA(foreground: string, background: string, { large = false }: { large?: boolean } = {}): boolean {
  return contrastRatio(foreground, background) >= (large ? AA_LARGE : AA_NORMAL);
}
