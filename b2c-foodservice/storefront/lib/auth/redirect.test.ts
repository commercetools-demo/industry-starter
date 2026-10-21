import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/auth/redirect';

describe('safeRedirect', () => {
  it('safeRedirect rejects absolute URLs, double slashes and backslashes', () => {
    for (const bad of [
      'https://evil.example', '//evil.example', '/\\evil.example', '/a//b', 'javascript:alert(1)', 'account',
      '/a\nb', '/a%2f%2fevil', '', null, undefined, `/${'a'.repeat(600)}`,
    ]) {
      expect(safeRedirect(bad, '/account')).toBe('/account');
    }
  });

  it('safeRedirect keeps a safe fragment', () => {
    expect(safeRedirect('/p/house-blend#reviews', '/account')).toBe('/p/house-blend#reviews');
    expect(safeRedirect('/checkout', '/account')).toBe('/checkout');
    expect(safeRedirect('/p/x#a b', '/account')).toBe('/account');
    expect(safeRedirect('/account/orders?x=1', '/account')).toBe('/account/orders?x=1');
  });
});
