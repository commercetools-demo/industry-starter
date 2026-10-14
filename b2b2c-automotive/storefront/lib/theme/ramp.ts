// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Derives the brand and accent ramps from one base colour (HSL, hue kept). Deltas are fitted to the design's
// Garage Maroon (#821810) and Chrome Gold (#d1a04a) ramps; see ramp.test.ts for the tolerances.
import { hslToRgb, rgbToHsl, toHex, type Rgb } from './color';

export type Stop = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
export type AccentStop = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export const BRAND_STOPS: readonly Stop[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export const ACCENT_STOPS: readonly AccentStop[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export const BRAND_DELTAS: Record<Stop, number> = { 50: 68, 100: 61, 200: 51, 300: 40, 400: 25, 500: 12, 600: 4, 700: 0, 800: -7, 900: -11, 950: -17 }; // 50 to 300 refit against the design (plan started at 66, 58, 47, 37)
export const ACCENT_DELTAS: Record<AccentStop, number> = { 50: 40, 100: 34, 200: 25, 300: 16, 400: 7, 500: 0, 600: -1, 700: -22, 800: -29, 900: -37 };

const MIN_L = 4;
const MAX_L = 97;
const MIN_STEP = 1.5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Lightness per stop (stops ascend, lightness descends). The anchor keeps the base lightness. Each other stop takes the
 * base lightness plus its delta, clamped to 4..97, then squeezed into the window that keeps every step at least
 * MIN_STEP. A base so extreme that no such window exists (near black or white) falls back to an even spread towards 0 or
 * 100, which is non-increasing (equal values only when the base itself is black or white).
 */
function lightnessScale<S extends number>(stops: readonly S[], deltas: Record<S, number>, anchor: S, baseL: number, pinned: Partial<Record<S, number>> = {}): Record<S, number> {
  const out = {} as Record<S, number>;
  const at = stops.indexOf(anchor);
  out[anchor] = baseL;
  const lighter = stops.slice(0, at).reverse(); // nearest the anchor first
  const darker = stops.slice(at + 1);
  const place = (chain: S[], direction: 1 | -1) => {
    const n = chain.length;
    const edge = direction === 1 ? 100 : 0;
    chain.forEach((s, i) => {
      const k = i + 1;
      const raw = pinned[s] ?? clamp(baseL + deltas[s], MIN_L, MAX_L);
      const near = baseL + direction * MIN_STEP * k;
      const far = direction === 1 ? MAX_L - MIN_STEP * (n - k) : MIN_L + MIN_STEP * (n - k);
      const feasible = direction === 1 ? near <= far : near >= far;
      if (!feasible) out[s] = baseL + ((edge - baseL) * k) / n;
      else out[s] = direction === 1 ? clamp(raw, near, far) : clamp(raw, far, near);
    });
  };
  place(lighter, 1);
  place(darker, -1);
  return out;
}

export function brandRamp(primary: Rgb, hover?: Rgb): Record<Stop, string> {
  const base = rgbToHsl(primary);
  const hoverHsl = hover ? rgbToHsl(hover) : null;
  const l = lightnessScale(BRAND_STOPS, BRAND_DELTAS, 700, base.l, hoverHsl ? { 600: Math.max(hoverHsl.l, base.l + MIN_STEP) } : {});
  const out = {} as Record<Stop, string>;
  for (const stop of BRAND_STOPS) {
    const s = stop === 50 || stop === 100 ? base.s * 0.85 : base.s;
    // The design's 800 leans 15 degrees towards crimson; a 3 degree shift keeps the fit inside the hue tolerance.
    const hue = stop === 800 ? base.h - 3 : base.h;
    out[stop] = toHex(hslToRgb(hue, s, l[stop]));
  }
  out[700] = toHex(primary);
  if (hover) out[600] = toHex(hover);
  return out;
}

export function accentRamp(accent: Rgb): Record<AccentStop, string> {
  const base = rgbToHsl(accent);
  const l = lightnessScale(ACCENT_STOPS, ACCENT_DELTAS, 500, base.l);
  const out = {} as Record<AccentStop, string>;
  for (const stop of ACCENT_STOPS) out[stop] = toHex(hslToRgb(base.h, base.s, l[stop]));
  out[500] = toHex(accent);
  return out;
}
