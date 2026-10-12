// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('accepts /account/orders', () => {
    expect(safeNext('/account/orders')).toBe('/account/orders');
    expect(safeNext('/cart?x=1')).toBe('/cart?x=1');
  });
  it('rejects //evil.example', () => expect(safeNext('//evil.example')).toBe('/account'));
  it('rejects https://evil.example', () => expect(safeNext('https://evil.example')).toBe('/account'));
  it('rejects backslash tricks', () => {
    expect(safeNext('/\\evil.example')).toBe('/account');
    expect(safeNext('\\\\evil.example')).toBe('/account');
  });
  it('rejects empty, missing and control characters', () => {
    expect(safeNext('')).toBe('/account');
    expect(safeNext(null)).toBe('/account');
    expect(safeNext(undefined)).toBe('/account');
    expect(safeNext('/a\nb')).toBe('/account');
  });
  it('uses the given fallback', () => {
    expect(safeNext('http://x', '/')).toBe('/');
  });
});
