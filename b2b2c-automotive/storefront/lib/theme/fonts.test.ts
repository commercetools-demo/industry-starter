// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { firstFamily, isAllowedFamily, resolveFontStack } from './fonts';

describe('Fonts are loaded from an allow-list', () => {
  it('Unknown family', () => {
    expect(resolveFontStack('Comic Sans MS, cursive')).toBe('system-ui, sans-serif');
    expect(isAllowedFamily('Comic Sans MS')).toBe(false);
  });
  it('Quoted family with a space', () => {
    expect(firstFamily('"Public Sans", system-ui')).toBe('Public Sans');
    expect(resolveFontStack("'Public Sans', sans-serif")).toBe('var(--font-public-sans), system-ui, sans-serif');
  });
  it('Case-insensitive match', () => {
    expect(isAllowedFamily('inter')).toBe(true);
    expect(resolveFontStack('ARCHIVO')).toBe('var(--font-archivo), system-ui, sans-serif');
  });
  it('Generic stack falls back to system-ui', () => {
    expect(resolveFontStack('sans-serif')).toBe('system-ui, sans-serif');
    expect(resolveFontStack('system-ui, sans-serif')).toBe('system-ui, sans-serif');
  });
  it('Hostile family is rejected', () => {
    expect(firstFamily('x;}</style><script>window.__pwned=1</script>')).toBeNull();
    expect(firstFamily('Inter, x;}')).toBeNull();
    expect(firstFamily('Ab"c, Inter')).toBeNull();
    expect(resolveFontStack('x;}</style>')).toBe('system-ui, sans-serif');
  });
  it('Empty value falls back', () => {
    expect(firstFamily('')).toBeNull();
    expect(firstFamily(undefined)).toBeNull();
    expect(resolveFontStack('')).toBe('system-ui, sans-serif');
    expect(resolveFontStack(null)).toBe('system-ui, sans-serif');
  });
  it('Allowed family maps to its CSS variable', () => {
    expect(resolveFontStack('Poppins, system-ui, sans-serif')).toBe('var(--font-poppins), system-ui, sans-serif');
    expect(resolveFontStack('Inter')).toBe('var(--font-inter), system-ui, sans-serif');
  });
});
