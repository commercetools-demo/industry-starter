// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { hslToRgb, parseColour, rgbToHsl, SAFE_CSS_VALUE, toHex } from './color';

describe('Hostile value: colour parsing', () => {
  it('Hex 3, 4, 6 and 8 digits parse', () => {
    expect(parseColour('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseColour('#abcd')).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseColour('#821810')).toEqual({ r: 130, g: 24, b: 16 });
    expect(parseColour('#82181080')).toEqual({ r: 130, g: 24, b: 16 });
    expect(parseColour('#82181')).toBeNull();
  });
  it('rgb and rgba parse', () => {
    expect(parseColour('rgb(130, 24, 16)')).toEqual({ r: 130, g: 24, b: 16 });
    expect(parseColour('rgba(130,24,16,0.5)')).toEqual({ r: 130, g: 24, b: 16 });
    expect(parseColour('rgb(300, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('hsl parses', () => {
    expect(parseColour('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColour('hsla(120, 100%, 25%, 0.4)')).toEqual({ r: 0, g: 128, b: 0 });
  });
  it('Named colour is rejected', () => {
    expect(parseColour('red')).toBeNull();
    expect(parseColour('transparent')).toBeNull();
  });
  it('Hostile string is rejected', () => {
    expect(parseColour(';}</style><script>alert(1)</script>')).toBeNull();
    expect(parseColour('#fff;}')).toBeNull();
    expect(SAFE_CSS_VALUE.test('a;b')).toBe(false);
  });
  it('url(...) is rejected', () => {
    expect(parseColour('url(javascript:alert(1))')).toBeNull();
    expect(parseColour('url(x)')).toBeNull();
  });
  it('Expression is rejected', () => {
    expect(parseColour('expression(alert(1))')).toBeNull();
    expect(parseColour('rgb(calc(1+1), 0, 0)')).toBeNull();
    expect(parseColour(42)).toBeNull();
    expect(parseColour(null)).toBeNull();
  });
  it('Round trip hex to hsl to hex stays within 1 per channel', () => {
    for (const hex of ['#821810', '#d1a04a', '#1f6f43', '#1d3b78', '#ffffff', '#000000', '#2a6fdb']) {
      const rgb = parseColour(hex)!;
      const { h, s, l } = rgbToHsl(rgb);
      const back = hslToRgb(h, s, l);
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });
  it('toHex is lowercase six digits', () => {
    expect(toHex({ r: 255, g: 10, b: 0 })).toBe('#ff0a00');
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });
});
