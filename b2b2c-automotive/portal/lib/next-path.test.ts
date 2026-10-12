// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { isAuthRoute, sanitizeNext } from './next-path';

describe('Sign-in return path', () => {
  it('Keeps an app-relative path and its query', () => {
    expect(sanitizeNext('/catalog')).toBe('/catalog');
    expect(sanitizeNext('/catalog?tab=assortment&sku=BP-100')).toBe('/catalog?tab=assortment&sku=BP-100');
    expect(sanitizeNext('/')).toBe('/');
  });
  it('Removes a leading locale because the router adds it', () => {
    expect(sanitizeNext('/de-DE/catalog')).toBe('/catalog');
    expect(sanitizeNext('/en-US')).toBe('/');
  });
  it.each([
    ['//evil.example', 'protocol-relative'],
    ['///evil.example', 'triple slash'],
    ['/\\evil.example', 'backslash'],
    ['https://evil.example/x', 'absolute URL'],
    ['javascript:alert(1)', 'script scheme'],
    ['catalog', 'no leading slash'],
    ['/.//evil.example', 'dot segments hiding a double slash'],
    ['/catalog\n/x', 'control character'],
    ['/a\u0000b', 'NUL'],
    ['', 'empty'],
    ['/api/auth/logout', 'API route'],
    ['/de-DE/api/health', 'API route behind a locale'],
    ['/sign-in', 'auth route (sign-in loop)'],
    ['/en-US/register', 'auth route behind a locale'],
    [`/${'a'.repeat(600)}`, 'too long'],
  ])('Refuses %s (%s)', (value) => {
    expect(sanitizeNext(value)).toBeUndefined();
  });
  it('Refuses a missing value', () => {
    expect(sanitizeNext(null)).toBeUndefined();
    expect(sanitizeNext(undefined)).toBeUndefined();
  });
  it('Knows the auth routes', () => {
    expect(isAuthRoute('sign-in')).toBe(true);
    expect(isAuthRoute('catalog')).toBe(false);
    expect(isAuthRoute(undefined)).toBe(false);
  });
});
