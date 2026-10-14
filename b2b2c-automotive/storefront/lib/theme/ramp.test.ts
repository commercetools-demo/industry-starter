// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { parseColour, rgbToHsl, toHex } from './color';
import { accentRamp, ACCENT_STOPS, BRAND_STOPS, brandRamp } from './ramp';

const rgb = (hex: string) => parseColour(hex)!;
const light = (hex: string) => rgbToHsl(rgb(hex)).l;
const hueGap = (a: string, b: string) => {
  const d = Math.abs(rgbToHsl(rgb(a)).h - rgbToHsl(rgb(b)).h) % 360;
  return Math.min(d, 360 - d);
};

describe('Storefront renders only from semantic automotive tokens: ramps', () => {
  it('Brand 700 is exactly the primary', () => {
    expect(brandRamp(rgb('#1f6f43'))[700]).toBe('#1f6f43');
    expect(brandRamp(rgb('#821810'))[700]).toBe('#821810');
  });
  it('Hover colour becomes stop 600', () => {
    expect(brandRamp(rgb('#1f6f43'), rgb('#185a37'))[600]).toBe('#185a37');
  });
  it('Brand ramp is monotonic for dark, mid and light primaries', () => {
    for (const primary of ['#821810', '#1f6f43', '#f2c94c']) {
      const ramp = brandRamp(rgb(primary));
      const ls = BRAND_STOPS.map((s) => rgbToHsl(rgb(ramp[s])).l);
      for (let i = 1; i < ls.length; i += 1) expect(ls[i]).toBeLessThan(ls[i - 1]);
    }
  });
  it('Brand ramp of Garage Maroon is within tolerance of the design', () => {
    const design: Record<number, string> = { 50: '#fcefee', 100: '#f7d6d3', 200: '#eeaea9', 300: '#e2807a', 400: '#d34440', 500: '#b02a22', 600: '#911c14', 800: '#6d0115', 900: '#551205', 950: '#3a0c03' };
    const ramp = brandRamp(rgb('#821810'), rgb('#911c14'));
    for (const [stop, expected] of Object.entries(design)) {
      const got = ramp[Number(stop) as keyof typeof ramp];
      expect(Math.abs(light(got) - light(expected)), `stop ${stop} lightness ${got} vs ${expected}`).toBeLessThanOrEqual(4);
      expect(hueGap(got, expected), `stop ${stop} hue ${got} vs ${expected}`).toBeLessThanOrEqual(15);
    }
  });
  it('Accent 500 is exactly the accent', () => {
    expect(accentRamp(rgb('#2a6fdb'))[500]).toBe('#2a6fdb');
  });
  it('Accent ramp of Chrome Gold is within tolerance', () => {
    const design: Record<number, string> = { 50: '#fff8e8', 100: '#fdeccb', 200: '#f9dc9f', 300: '#f5cb73', 400: '#e0b867', 700: '#8c5c1b', 800: '#6b4514', 900: '#4a2f0e' };
    const ramp = accentRamp(rgb('#d1a04a'));
    for (const [stop, expected] of Object.entries(design)) {
      const got = ramp[Number(stop) as keyof typeof ramp];
      expect(Math.abs(light(got) - light(expected)), `stop ${stop} lightness ${got} vs ${expected}`).toBeLessThanOrEqual(4);
      expect(hueGap(got, expected), `stop ${stop} hue ${got} vs ${expected}`).toBeLessThanOrEqual(15);
    }
  });
  it('Black and white primaries still give a valid monotonic ramp', () => {
    for (const primary of ['#000000', '#ffffff']) {
      const ramp = brandRamp(rgb(primary));
      const ls = BRAND_STOPS.map((s) => {
        expect(ramp[s]).toMatch(/^#[0-9a-f]{6}$/);
        return rgbToHsl(rgb(ramp[s])).l;
      });
      for (let i = 1; i < ls.length; i += 1) expect(ls[i]).toBeLessThanOrEqual(ls[i - 1] + 0.001);
      const acc = accentRamp(rgb(primary));
      for (const s of ACCENT_STOPS) expect(toHex(rgb(acc[s]))).toBe(acc[s]);
    }
  });
});
