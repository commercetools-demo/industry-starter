// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { validateBrandingImage } from './validate';

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}
function jpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x0b, 8], 0);
  b[13] = height >> 8;
  b[14] = height & 255;
  b[15] = width >> 8;
  b[16] = width & 255;
  return b;
}
function webpX(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 0);
  const w = width - 1;
  const h = height - 1;
  b.set([w & 255, (w >> 8) & 255, (w >> 16) & 255], 24);
  b.set([h & 255, (h >> 8) & 255, (h >> 16) & 255], 27);
  return b;
}
const gif = new Uint8Array(40).map((_, i) => 'GIF89a'.charCodeAt(i) || 0);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><script>alert(1)</script></svg>');

describe('branding image rules', () => {
  it('a PNG logo 800 x 400 is accepted', () => expect(validateBrandingImage(png(800, 400), 'logo')).toMatchObject({ ok: true, width: 800, height: 400, mime: 'image/png', extension: 'png' }));
  it('a logo narrower than 600 px is refused with the limit text', () => {
    const result = validateBrandingImage(png(599, 400), 'logo');
    expect(result).toEqual({ ok: false, message: 'Use a JPG, PNG or WebP at least 600 px wide and at most 5 MB.' });
  });
  it('favicon needs 128 x 128; 50 x 50 is refused', () => {
    expect(validateBrandingImage(png(128, 128), 'favicon').ok).toBe(true);
    expect(validateBrandingImage(png(50, 50), 'favicon')).toEqual({ ok: false, message: 'Use a JPG, PNG or WebP of at least 128 x 128 px and at most 5 MB.' });
    expect(validateBrandingImage(png(200, 100), 'favicon').ok).toBe(false);
  });
  it('JPEG and WebP headers are read', () => {
    expect(validateBrandingImage(jpeg(700, 300), 'logo')).toMatchObject({ ok: true, width: 700, height: 300, extension: 'jpg' });
    expect(validateBrandingImage(webpX(900, 450), 'logo')).toMatchObject({ ok: true, width: 900, height: 450, extension: 'webp' });
  });
  it('GIF, SVG and text are refused whatever the file name says', () => {
    expect(validateBrandingImage(gif, 'logo').ok).toBe(false);
    expect(validateBrandingImage(svg, 'logo').ok).toBe(false);
    expect(validateBrandingImage(new TextEncoder().encode('just some text that is long enough to pass the size gate'), 'favicon').ok).toBe(false);
  });
  it('more than 5 MB is refused', () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(png(800, 400));
    expect(validateBrandingImage(big, 'logo').ok).toBe(false);
  });
  it('a truncated file is refused', () => expect(validateBrandingImage(png(800, 400).slice(0, 10), 'logo').ok).toBe(false));
});
