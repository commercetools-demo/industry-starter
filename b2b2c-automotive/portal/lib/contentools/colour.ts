// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Colour parsing for theme values read from Contentools, copied from storefront/lib/theme/color.ts (workstream H) with the same
// safe-CSS first gate. Raw colour notation is the purpose of this file (exempt in scripts/check-tokens.mjs).
// Nothing from an input string is ever returned: every colour that leaves comes out of toHex().
import 'server-only';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** The Malva automotive default theme's primary colour (storefront/lib/theme/default-theme.json `colorPrimary`). */
export const MALVA_DEFAULT_PRIMARY = '#821810';

/** First gate for any raw theme string: no quote, semicolon, brace, angle bracket, slash, colon or backslash. */
export const SAFE_CSS_VALUE = /^[A-Za-z0-9#(),.%\s_-]{1,200}$/;

const clampByte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUM = String.raw`(\d{1,3}(?:\.\d+)?)`;
const SEP = String.raw`\s*(?:,\s*|\s)`;
const ALPHA = String.raw`(?:${SEP}(?:\d*\.?\d+%?))?`;
const RGB_FN = new RegExp(String.raw`^rgba?\(\s*${NUM}${SEP}${NUM}${SEP}${NUM}${ALPHA}\s*\)$`, 'i');
const HSL_FN = new RegExp(String.raw`^hsla?\(\s*(\d{1,3}(?:\.\d+)?)(?:deg)?${SEP}${NUM}%${SEP}${NUM}%${ALPHA}\s*\)$`, 'i');

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const lig = Math.min(100, Math.max(0, l)) / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: clampByte(f(0) * 255), g: clampByte(f(8) * 255), b: clampByte(f(4) * 255) };
}

/** Hex 3/4/6/8 digits, rgb()/rgba(), hsl()/hsla(); everything else is null. Alpha is dropped. */
export function parseColour(raw: unknown): Rgb | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!SAFE_CSS_VALUE.test(text)) return null;
  const hex = HEX.exec(text);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((ch) => ch + ch).join('');
    const n = Number.parseInt(h.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgb = RGB_FN.exec(text);
  if (rgb) return { r: clampByte(Number(rgb[1])), g: clampByte(Number(rgb[2])), b: clampByte(Number(rgb[3])) };
  const hsl = HSL_FN.exec(text);
  if (hsl) return hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
  return null;
}

export function toHex(c: Rgb): string {
  const part = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${part(c.r)}${part(c.g)}${part(c.b)}`;
}
