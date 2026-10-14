/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { IMAGE_LIMIT_MESSAGE, validateImage } from './image-rules';

function png(width: number, height: number, padTo = 64): Uint8Array {
  const b = new Uint8Array(Math.max(padTo, 33));
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}
function jpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8]);
  new DataView(b.buffer).setUint16(13, height);
  new DataView(b.buffer).setUint16(15, width);
  return b;
}
function webpX(width: number, height: number): Uint8Array {
  const b = new Uint8Array(64);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0]);
  const w = width - 1;
  const h = height - 1;
  b.set([w & 255, (w >> 8) & 255, (w >> 16) & 255, h & 255, (h >> 8) & 255, (h >> 16) & 255], 24);
  return b;
}

describe('validateImage', () => {
  it('gif refused; 599 px refused; 11 MB refused; mime lie (png bytes named .jpg) accepted by bytes; exe renamed .png refused', () => {
    const gif = new Uint8Array(64);
    gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(validateImage(gif, 'image/gif')).toEqual({ ok: false, message: IMAGE_LIMIT_MESSAGE });
    expect(validateImage(png(599, 800))).toEqual({ ok: false, message: IMAGE_LIMIT_MESSAGE });
    expect(validateImage(png(800, 599))).toEqual({ ok: false, message: IMAGE_LIMIT_MESSAGE });
    expect(validateImage(png(800, 800, 11 * 1024 * 1024))).toEqual({ ok: false, message: IMAGE_LIMIT_MESSAGE });
    expect(validateImage(png(800, 800), 'image/jpeg')).toEqual({ ok: true, width: 800, height: 800, mime: 'image/png' });
    const exe = new Uint8Array(64);
    exe.set([0x4d, 0x5a]);
    expect(validateImage(exe, 'image/png')).toEqual({ ok: false, message: IMAGE_LIMIT_MESSAGE });
  });

  it('accepts a 600 x 600 JPEG and WebP and exactly 10 MB', () => {
    expect(validateImage(jpeg(600, 600))).toMatchObject({ ok: true, width: 600, height: 600, mime: 'image/jpeg' });
    expect(validateImage(webpX(1200, 900))).toMatchObject({ ok: true, width: 1200, height: 900, mime: 'image/webp' });
    expect(validateImage(png(800, 800, 10 * 1024 * 1024)).ok).toBe(true);
  });

  it('refuses truncated files', () => {
    expect(validateImage(new Uint8Array([0x89, 0x50])).ok).toBe(false);
    expect(validateImage(new Uint8Array(0)).ok).toBe(false);
  });

  it('states the limits in the exact message', () => {
    expect(IMAGE_LIMIT_MESSAGE).toBe('Use a JPG, PNG or WebP of at least 600 x 600 px and at most 10 MB.');
  });
});
