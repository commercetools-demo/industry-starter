/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Image intake rules (T-08): JPG, PNG or WebP by magic bytes (never by Content-Type or file name), at least 600 x 600 px,
// at most 10 MB. Dimensions are read from the file header, so no image library is needed. Pure.
export const MIN_IMAGE_SIDE = 600;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_LIMIT_MESSAGE = 'Use a JPG, PNG or WebP of at least 600 x 600 px and at most 10 MB.';

export type ImageCheck = { ok: true; width: number; height: number; mime: 'image/jpeg' | 'image/png' | 'image/webp' } | { ok: false; message: string };

const fail = (): ImageCheck => ({ ok: false, message: IMAGE_LIMIT_MESSAGE });
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
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return [u16be(b, o + 7), u16be(b, o + 5)];
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

/** `declaredMime` and the file name are ignored on purpose: the bytes decide. */
export function validateImage(buffer: Uint8Array, declaredMime?: string): ImageCheck {
  void declaredMime;
  if (buffer.length > MAX_IMAGE_BYTES || buffer.length < 24) return fail();
  let mime: 'image/jpeg' | 'image/png' | 'image/webp';
  let size: [number, number] | null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    mime = 'image/jpeg';
    size = jpegSize(buffer);
  } else if (u32be(buffer, 0) === 0x89504e47 && u32be(buffer, 4) === 0x0d0a1a0a) {
    mime = 'image/png';
    size = pngSize(buffer);
  } else if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') {
    mime = 'image/webp';
    size = webpSize(buffer);
  } else return fail();
  if (!size || size[0] < MIN_IMAGE_SIDE || size[1] < MIN_IMAGE_SIDE) return fail();
  return { ok: true, width: size[0], height: size[1], mime };
}
