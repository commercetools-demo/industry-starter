// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure colour maths for the theme adapter. Raw colour notation is the purpose of this file (exempt in check-tokens).
// The adapter never copies an input string into CSS: every colour that reaches the stylesheet comes out of toHex().

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** First gate for any raw theme string: no quote, semicolon, brace, angle bracket, slash, colon or backslash. */
export const SAFE_CSS_VALUE = /^[A-Za-z0-9#(),.%\s_-]{1,200}$/;

const clampByte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUM = String.raw`(\d{1,3}(?:\.\d+)?)`;
const SEP = String.raw`\s*(?:,\s*|\s)`;
const ALPHA = String.raw`(?:${SEP}(?:\d*\.?\d+%?))?`;
const RGB_FN = new RegExp(String.raw`^rgba?\(\s*${NUM}${SEP}${NUM}${SEP}${NUM}${ALPHA}\s*\)$`, 'i');
const HSL_FN = new RegExp(String.raw`^hsla?\(\s*(\d{1,3}(?:\.\d+)?)(?:deg)?${SEP}${NUM}%${SEP}${NUM}%${ALPHA}\s*\)$`, 'i');

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const lig = Math.min(100, Math.max(0, l)) / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: clampByte(f(0) * 255), g: clampByte(f(8) * 255), b: clampByte(f(4) * 255) };
}

export function rgbToHsl(c: Rgb): { h: number; s: number; l: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
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
