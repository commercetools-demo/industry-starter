// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Intake rules for the store logo and favicon (workstream U-05): JPG, PNG or WebP by magic bytes (never by Content-Type or file
// name; SVG is refused because it can carry script), dimensions read from the file header. The favicon needs at least 128 x 128
// px, the logo at least 600 px of width; both at most 5 MB. The header readers follow lib/catalog/image-rules.ts (workstream T).
// Pure.
export const MAX_BRANDING_BYTES = 5 * 1024 * 1024;
export const FAVICON_MIN_SIDE = 128;
export const LOGO_MIN_WIDTH = 600;
export const FAVICON_LIMIT_MESSAGE = 'Use a JPG, PNG or WebP of at least 128 x 128 px and at most 5 MB.';
export const LOGO_LIMIT_MESSAGE = 'Use a JPG, PNG or WebP at least 600 px wide and at most 5 MB.';

export type BrandingKind = 'logo' | 'favicon';
export type Mime = 'image/jpeg' | 'image/png' | 'image/webp';
export type BrandingCheck = { ok: true; width: number; height: number; mime: Mime; extension: 'jpg' | 'png' | 'webp' } | { ok: false; message: string };

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));

function pngSize(b: Uint8Array): [number, number] | null {
  return b.length >= 24 && ascii(b, 12, 4) === 'IHDR' ? [u32be(b, 16), u32be(b, 20)] : null;
}

function jpegSize(b: Uint8Array): [number, number] | null {
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    if (marker === 0xff) {
      o += 1;
      continue;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [u16be(b, o + 7), u16be(b, o + 5)];
    o += 2 + u16be(b, o + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): [number, number] | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8X') return [1 + u24le(b, 24), 1 + u24le(b, 27)];
  if (chunk === 'VP8 ') return [u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff];
  if (chunk === 'VP8L') {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  return null;
}

export function validateBrandingImage(buffer: Uint8Array, kind: BrandingKind): BrandingCheck {
  const message = kind === 'logo' ? LOGO_LIMIT_MESSAGE : FAVICON_LIMIT_MESSAGE;
  const fail = (): BrandingCheck => ({ ok: false, message });
  if (buffer.length > MAX_BRANDING_BYTES || buffer.length < 24) return fail();
  let mime: Mime;
  let extension: 'jpg' | 'png' | 'webp';
  let size: [number, number] | null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    mime = 'image/jpeg';
    extension = 'jpg';
    size = jpegSize(buffer);
  } else if (u32be(buffer, 0) === 0x89504e47 && u32be(buffer, 4) === 0x0d0a1a0a) {
    mime = 'image/png';
    extension = 'png';
    size = pngSize(buffer);
  } else if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') {
    mime = 'image/webp';
    extension = 'webp';
    size = webpSize(buffer);
  } else return fail();
  if (!size) return fail();
  const [width, height] = size;
  const big = kind === 'logo' ? width >= LOGO_MIN_WIDTH && height > 0 : width >= FAVICON_MIN_SIDE && height >= FAVICON_MIN_SIDE;
  return big ? { ok: true, width, height, mime, extension } : fail();
}
