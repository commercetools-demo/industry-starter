import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('Return after sign-in: a relative path in the same locale is kept (with query)', () => {
    expect(safeRedirectPath('/en-US/saved', 'en-US')).toBe('/en-US/saved');
    expect(safeRedirectPath('/en-US/account/orders?page=2', 'en-US')).toBe('/en-US/account/orders?page=2');
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute URL', 'https://evil.com'],
    ['absolute URL inside a path', '/en-US/x?next=https://evil.com'],
    ['backslash trick', '/\\evil.com'],
    ['another locale', '/de-DE/account'],
    ['missing locale', '/account'],
    ['no leading slash', 'en-US/account'],
    ['control character', '/en-US/\n/evil'],
    ['locale prefix lookalike', '/en-USA/x'],
  ])('%s: falls back to the account page', (_name, input) => {
    expect(safeRedirectPath(input, 'en-US')).toBe('/en-US/account');
  });

  it('empty, null and undefined fall back', () => {
    expect(safeRedirectPath('', 'de-DE')).toBe('/de-DE/account');
    expect(safeRedirectPath(null, 'de-DE')).toBe('/de-DE/account');
    expect(safeRedirectPath(undefined, 'de-DE')).toBe('/de-DE/account');
  });
});
